/* global it */
import main from '../index.js'
import parse from './parse.js'

const test = it

const testThrow = (fn, msg) => {
  try {
    fn()
    throw new Error('Failed to throw')
  } catch (e) {
    if (e.message !== msg) throw e
  }
}

test('default enum', async () => {
  const schema = `
  type TestEnum enum {
    | Yes
    | No
  }
  `
  const validate = main(parse(schema))
  validate('Yes', 'TestEnum')
  validate('No', 'TestEnum')
  testThrow(() => validate('yes', 'TestEnum'), 'Invalid enum value "yes"')
  testThrow(() => validate('no', 'TestEnum'), 'Invalid enum value "no"')
})

test('specify enum strings', async () => {
  const schema = `
  type TestEnum enum {
    | Yes ("yes")
    | No ("no")
  }
  `
  const validate = main(parse(schema))
  validate('yes', 'TestEnum')
  validate('no', 'TestEnum')
  testThrow(() => validate('Yes', 'TestEnum'), 'Invalid enum value "Yes"')
  testThrow(() => validate('No', 'TestEnum'), 'Invalid enum value "No"')
})

test('enum int representation', async () => {
  const schema = `
  type TestEnum enum {
    | Yes ("1")
    | No ("0")
  } representation int
  `
  const validate = main(parse(schema))
  validate(1, 'TestEnum')
  validate(0, 'TestEnum')
  testThrow(() => validate(2, 'TestEnum'), 'Invalid enum value 2')
  testThrow(() => validate('1', 'TestEnum'), 'Invalid enum value "1"')
})
