const types = {}

const isBinary = o => {
  if (o instanceof Uint8Array && o.constructor.name === 'Uint8Array') return true
  return false
}
const strf = obj => JSON.stringify(obj)

const isCID = obj => obj && typeof obj === 'object' && obj.asCID && obj.asCID === obj

const readonly = (obj, key, value) => Object.defineProperty(obj, key, { value })

const validateField = (api, key, schema, value) => {
  if (typeof value === 'undefined') {
    if (schema.optional) return
    throw new Error(`"${key}" is undefined`)
  }
  if (value === null) {
    if (schema.type === 'Null' || schema.nullable) return
    throw new Error(`Cannot be null "${key}"`)
  }
  if (typeof schema.type === 'string') {
    if (kinds[schema.type]) return (new kinds[schema.type](api, schema)).validate(value)
    if (!api[schema.type]) throw new VE('Missing type', schema.type)
    return api[schema.type].validate(value)
  } else if (typeof schema.type === 'object') {
    if (schema.type.kind === 'link') {
      return api.Link.validate(value)
    } else if (schema.type.kind === 'map') {
      return api.Map.validate(value, schema.type)
    }
    throw new Error('Unknown field type ' + strf(schema.type))
  }
  api[schema.type].validate(value)
  return value
}

class ValidationError extends Error {
  constructor (msg, obj) {
    super(msg + ' ' + strf(obj))
    this.value = obj
  }
}

const VE = ValidationError

class SchemaType {
  constructor (api, schema) {
    this.api = api
    this.schema = schema
  }
}
types.Map = class Map extends SchemaType {
  validate (obj, fieldSchema) {
    if (typeof obj !== 'object') throw new VE('Must be object', obj)
    if (Array.isArray(obj)) throw new VE('Cannot be array', obj)
    if (!this.schema) return obj
    // TODO: accept Map objects and validate keys
    for (const [key, value] of Object.entries(obj)) {
      const schema = fieldSchema || this.schema
      validateField(this.api, key, { type: schema.keyType }, key)
      validateField(this.api, key, { type: schema.valueType }, value)
    }
    return obj
  }
}
readonly(types.Map, 'kind', 'map')
types.Struct = class Struct extends SchemaType {
  constructor (api, schema) {
    super(api, schema)
    this.representation = Object.keys(this.schema.representation)[0]
    if (this.representation === 'map' && schema.representation.map.fields) {
      for (const [key, value] of Object.entries(schema.representation.map.fields)) {
        if (value.rename) {
          schema.fields[value.rename] = schema.fields[key]
          delete schema.fields[key]
        }
      }
    }
  }

  validate (obj) {
    switch (this.representation) {
      case 'map': return this.validateMap(obj)
      case 'tuple': return this.validateTuple(obj)
      default: throw new VE('Unknown representation', this.schema.representation)
    }
  }

  validateTuple (obj) {
    if (!Array.isArray(obj)) throw new VE('Value must be list for tuple representation', obj)
    const values = [...obj]
    for (const [key, schema] of Object.entries(this.schema.fields)) {
      validateField(this.api, key, schema, values.shift())
    }
    if (values.length) throw new VE('Too many values in tuple', values)
    return obj
  }

  validateMap (obj) {
    if (obj === null || typeof obj !== 'object' || isCID(obj) || Array.isArray(obj)) {
      throw new VE('Value must be map when using keyed representation', obj)
    }
    for (const [key, schema] of Object.entries(this.schema.fields)) {
      validateField(this.api, key, schema, obj[key])
    }
    return obj
  }
}
readonly(types.Struct, 'kind', 'struct')
readonly(types.Struct, 'schemaType', true)

const getKind = value => {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'string') return 'string'
  if (type === 'number') {
    if (Number(value) === value && value % 1 === 0) return 'int'
    return 'float'
  }
  if (type === 'object') {
    if (isBinary(value)) return 'bytes'
    if (isCID(value)) return 'link'
    if (Array.isArray(value)) return 'list'
    return 'map'
  }
  // istanbul ignore next
  throw new VE('Cannot find type', value)
}

types.Union = class Union extends SchemaType {
  constructor (api, schema) {
    super(api, schema)
    this.representation = Object.keys(this.schema.representation)[0]
  }

  validate (obj) {
    ;;
    switch (this.representation) {
      case 'keyed': return this.validateKeyed(obj)
      case 'kinded': return this.validateKinded(obj)
      default: throw new VE('Unknown representation', this.schema.representation)
    }
  }

  validateKinded (obj) {
    const kind = getKind(obj)
    const key = this.schema.representation.kinded[kind]
    if (!key) throw new VE('Union does not have kind', kind)
    if (typeof key === 'object') {
      if (key.kind === 'link') {
        if (obj.asCID !== obj) throw new VE('Value is not link', 'link')
        return obj
      } else {
        throw new Error('Not implemented')
      }
    }
    this.api[key].validate(obj)
    return obj
  }

  validateKeyed (obj) {
    const schema = this.schema.representation.keyed
    const key = Object.keys(obj)[0]
    if (!schema[key]) throw new VE('Unknown union key', key)
    const name = schema[key]
    if (typeof name === 'object') {
      if (!name.kind || name.kind !== 'link') throw new Error("Don't know what this schema feature is")
      if (!isCID(obj[key])) throw new VE('Property must be link', name)
    } else {
      if (!this.api[name]) throw new VE('Missing type named', name)
      this.api[name].validate(obj[key])
    }
    return obj
  }
}
readonly(types.Union, 'kind', 'union')
readonly(types.Union, 'schemaType', true)

types.Enum = class Enum extends SchemaType {
  constructor (api, schema) {
    super(api, schema)
    this.representation = Object.keys(this.schema.representation)[0]
    this.members = new Set()
    let members = schema.representation[this.representation]
    if (Object.keys(members).length === 0) members = schema.members
    for (const [key, value] of Object.entries(members)) {
      if (value === null) this.members.add(key)
      else {
        if (this.representation === 'int') this.members.add(parseInt(value))
        else if (this.representation === 'string') this.members.add(value)
        else throw new Error('Unknown representation')
      }
    }
  }

  validate (obj) {
    if (this.members.has(obj)) return obj
    throw new VE('Invalid enum value', obj)
  }
}
readonly(types.Enum, 'kind', 'enum')
readonly(types.Enum, 'schemaType', true)

types.List = class List extends SchemaType {
  validate (obj) {
    if (!Array.isArray(obj)) throw new VE('Not encoded as list', obj)
    if (!this.schema) return obj
    let i = 0
    for (const value of obj) {
      i++
      validateField(this.api, i, { type: this.schema.valueType }, value)
    }
    return obj
  }
}
readonly(types.List, 'kind', 'list')
types.String = class String extends SchemaType {
  validate (obj) {
    if (typeof obj !== 'string') throw new VE('Must be string', obj)
    return obj
  }
}
readonly(types.String, 'kind', 'string')
types.Link = class Link extends SchemaType {
  validate (obj) {
    if (!isCID(obj)) throw new VE('Not a valid link', obj)
    return obj
  }
}
readonly(types.Link, 'kind', 'link')
types.Bytes = class Bytes extends SchemaType {
  validate (obj) {
    if (isBinary(obj)) return obj
    throw new VE('Not a valid binary object', obj)
  }
}
readonly(types.Bytes, 'kind', 'bytes')
types.Int = class Int extends SchemaType {
  validate (obj) {
    if (typeof obj !== 'number') throw new VE('Must be a number', obj)
    if (Number(obj) === obj && obj % 1 !== 0) throw new VE('Int must not be a float', obj)
    return obj
  }
}
readonly(types.Int, 'kind', 'int')
types.Float = class Float extends SchemaType {
  validate (obj) {
    if (typeof obj !== 'number') throw new VE('Must be a number', obj)
    if (Number(obj) === obj && obj % 1 === 0) throw new VE('Int must not be a float', obj)
    return obj
  }
}
readonly(types.Float, 'kind', 'float')
types.Bool = class Bool extends SchemaType {
  validate (obj) {
    if (typeof obj !== 'boolean') throw new VE('Must be boolean', obj)
    return obj
  }
}
readonly(types.Bool, 'kind', 'bool')
types.Null = class Null extends SchemaType {
  validate (obj) {
    if (obj === null) return null
    throw new VE('Must be null', obj)
  }
}
readonly(types.Null, 'kind', 'null')

const kinds = {}
for (const [, CLS] of Object.entries(types)) {
  kinds[CLS.kind] = CLS
}

const addSchemas = (api, ...schemas) => {
  for (const parsed of schemas) {
    for (const [key, schema] of Object.entries(parsed.types)) {
      if (api[key]) throw new Error('Cannot create duplicate type: ' + key)
      if (!schema.kind) throw new Error('Not implemented')
      const CLS = kinds[schema.kind]
      if (!CLS) throw new Error('No kind named "' + schema.kind + '"')
      api[key] = new CLS(api, schema)
      api[key].name = key
    }
  }
  const ret = (value, typeName) => {
    if (!api[typeName]) throw new Error(`No type named "${typeName}"`)
    const v = api[typeName].validate(value)
    if (value !== v) throw new Error("Uh oh! There's a bug in the schema validator, sorry.")
    return v
  }
  ret.addSchemas = (...schemas) => addSchemas(api, ...schemas)
  return ret
}
const create = (...schemas) => {
  const api = {}
  for (const [name, CLS] of Object.entries(types)) {
    if (!CLS.schemaType) api[name] = new CLS(api)
  }
  return addSchemas(api, ...schemas)
}
export default create
