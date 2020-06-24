/* global it */
import main from '../index.js'
import parse from './parse.js'
import { fromString } from 'multiformats/bytes.js'

const test = it

test('read bytes', async () => {
  const schema = `
  type TestBytes bytes
  `
  const validate = main(parse(schema))
  validate(fromString('asdf'), 'TestBytes')
})
