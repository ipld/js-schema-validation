# ipld-schema-validation

```js
const schema = require('./schema.json')
const validate = require('ipld-schema-validation')(schema)

validate({ hello: 'world' }, 'TypeName')
```
