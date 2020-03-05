const types = {}
const bytes = require('bytesish')

const strf = obj => JSON.stringify(obj)
const cidSymbol = Symbol.for('@ipld/js-cid/CID')
const isCID = node => !!(node && node[cidSymbol])

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
  if (!api[schema.type]) {
    console.error({api, type: schema.type, value})
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
  static isNode = true
}
types.Map = class Map extends SchemaType {
  static kind = 'map'
  validate (obj, fieldSchema) {
    if (typeof obj !== 'object') throw new VE('Must be object', obj)
    if (Array.isArray(obj)) throw new VE('Cannot be array', obj)
    if (!this.schema) return obj
    // TODO: accept Map objects and validate keys
    for (const [key, value] of Object.entries(obj)) {
      const schema = fieldSchema || this.schema
      validateField(this.api, key, {type: schema.keyType}, key)
      validateField(this.api, key, {type: schema.valueType}, value)
    }
    return obj
  }
}
types.Struct = class Struct extends SchemaType {
  static kind = 'struct'
  static schemaType = true
  constructor (api, schema) {
    super(api, schema)
    this.representation = Object.keys(this.schema.representation)[0]
  }
  validate (obj) {
    switch (this.representation) {
      case "map": return this.validateMap(obj)
      default: throw new VE('Unknown representation', this.schema.representation)
    }
  }
  validateMap (obj) {
    for (const [key, schema] of Object.entries(this.schema.fields)) {
      validateField(this.api, key, schema, obj[key])
    }
    return obj
  }
}
types.Union = class Union extends SchemaType {
  static kind = 'union'
  static schemaType = true
  constructor (api, schema) {
    super(api, schema)
    this.representation = Object.keys(this.schema.representation)[0]
  }
  validate (obj) {
    switch (this.representation) {
      case "keyed": return this.validateKeyed(obj)
      default: throw new VE('Unknown representation', this.schema.representation)
    }
  }
  validateKeyed (obj) {
    const schema = this.schema.representation.keyed
    const key = Object.keys(obj)[0]
    if (!schema[key]) throw new VE(`Unknown union key`, key)
    const name = schema[key]
    if (!this.api[name]) throw new VE(`Missing type named`, name)
    this.api[name].validate(obj[key])
    return obj
  }
}
types.List = class List extends SchemaType {
  static kind = 'list'
  validate (obj) {
    if (!Array.isArray(obj)) throw new VE('Not encoded as list', obj)
    if (!this.schema) return obj
    let i = 0
    for (const value of obj) {
      i++
      validateField(this.api, i, {type: this.schema.valueType}, value)
    }
    return obj
  }
}
types.String = class String extends SchemaType {
  static kind = 'string'
  validate (obj) {
    if (typeof obj !== 'string') throw new VE('Must be string', obj)
    return obj
  }
}
types.Link = class Link extends SchemaType {
  static kind = 'link'
  validate (obj) {
    if (!isCID(obj)) throw new VE('Not a valid link', obj)
    return obj
  }
}
types.Bytes = class Bytes extends SchemaType {
  static kind = 'bytes'
  validate (obj) {
    try {
      bytes(obj)
    } catch (e) {
      throw new VE('Not a valid binary object', obj)
    }
    return obj
  }
}
types.Int = class Int extends SchemaType {
  static kind = 'int'
  validate (obj) {
    if (typeof obj !== 'number') throw new VE('Must be a number', obj)
    if (Number(obj) === obj && obj % 1 !== 0) throw new VE('Int must not be a float', obj)
    return obj
  }
}
types.Float = class Float extends SchemaType {
  static kind = 'float'
  validate (obj) {
    if (typeof obj !== 'number') throw new VE('Must be a number', obj)
    if (Number(obj) === obj && obj % 1 === 0) throw new VE('Int must not be a float', obj)
    return obj
  }
}
types.Bool = class Bool extends SchemaType {
  static kind = 'bool'
  validate (obj) {
    if (typeof obj !== 'boolean') throw new VE('Must be boolean', obj)
    return obj
  }
}


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
module.exports = create
