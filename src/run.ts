import auto = require('./index')
import path = require('path')
const root = path.resolve(__dirname, "../")

auto.run({
    input_sql_file: root + '/flowerws.2017050516.sql',
    output_dir: '/Users/lyaotian/Documents/Web/feathers/test1/src/database/define',
    force_output: true,
})