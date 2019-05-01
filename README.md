# auto-sequelize-define
Auto generate sequelize define code by mysql sql export file

# usage
```
npm install auto-sequelize-define -D
```
```
import auto = require('auto-sequelize-define')
import path = require('path')
const root = path.resolve(__dirname, "../")

auto.run({
    input_sql_file: '...',
    output_dir: '...',
    force_output: true,
})
```