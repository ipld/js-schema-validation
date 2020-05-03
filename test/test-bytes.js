/* global it */
'use strict'
const { Buffer } = require('buffer')
const main = require('../')
const parse = require('./parse')

const test = it

test('read bytes', async () => {
  const schema = `
  type TestBytes bytes
  `
  const validate = main(parse(schema))
  validate(Buffer.from('asdf'), 'TestBytes')
})
