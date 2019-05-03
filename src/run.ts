import auto = require('./index')
import path = require('path')
const root = path.resolve(__dirname, "../")

auto.run({
    input_sql_file: root + '/flowerws_2019-05-01.sql',
    output_dir: '/Users/lyaotian/Documents/Work/MyProject/FlowerWS/go-huadao/database/model_',
    force_output: true,
})