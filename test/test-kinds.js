/* global it */
import assert from 'assert'
import main from '../index.js'
import parse from './parse.js'
import { fromString } from 'multiformats/bytes.js'

const test = it

const s = o => JSON.stringify(o)

test('all kinds', done => {
  const schema = `
  type TestString string
  type TestInt int
  type TestFloat float
  type TestBytes bytes
  type TestMap map
  type TestList list
  type TestBool bool
  `
  const validate = main(parse(schema))

  let _test = (name, valid) => {
    validate(valid, name)
  }
  _test('TestString', 'string')
  _test('TestInt', 120)
  _test('TestFloat', 1.2)
  _test('TestBytes', fromString('asdf'))
  _test('TestMap', {})
  _test('TestList', [])
  _test('TestBool', true)

  _test = (name, invalid) => {
    let threw = true
    try {
      validate(invalid, name)
      threw = false
    } catch (e) {
      assert.ok(true)
    }
    if (!threw) throw new Error(`${name} should have failed validation for ${s(invalid)}`)
  }
  _test('TestString', 100)
  _test('TestInt', 'string')
  _test('TestFloat', 100)
  _test('TestMap', [])
  _test('TestList', {})
  _test('TestNull', 'asdf')
  _test('TestBool', 'asdf')
  for (const key of ['String', 'Int', 'Float', 'Map', 'List', 'Null', 'Bool']) {
    // test undefined
    _test('Test' + key)
  }

  done()
})

test('all kinds in struct', done => {
  const schema = `
  type Test struct {
    string String
    int Int
    float Float
    bytes Bytes
    map Map
    list List
    null Null
  }
  `
  const validate = main(parse(schema))
  const hw = {
    string: 'test',
    int: 1,
    float: 1.1,
    bytes: fromString('test'),
    map: { hello: 'world' },
    list: [null],
    null: null
  }
  validate(hw, 'Test')
  done()
})

test('advanced features', done => {
  const schema = `
    type Foo string
    type Bar [Foo]
    type Baz [{String:Foo}]
  `
  const validate = main(parse(schema))

  let _test = (name, value) => {
    validate(value, name)
  }
  _test('Bar', ['asdf'])
  _test('Bar', [])
  _test('Baz', [{ adf: 'asdf' }])
  _test('Baz', [])

  _test = (name, invalid) => {
    let threw = true
    try {
      validate(invalid, name)
      threw = false
    } catch (e) {
      // noop
    }
    if (!threw) {
      throw new Error(`${name} should throw with ${s(invalid)}`)
    }
  }

  _test('Bar', [100])
  _test('Bar', { should: 'fail' })
  _test('Baz', [['asdf']])
  _test('Baz', [null])

  done()
})
