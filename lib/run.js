"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auto = require("./index");
const path = require("path");
const root = path.resolve(__dirname, "../");
auto.run({
    input_sql_file: root + '/flowerws.2017050516.sql',
    output_dir: '/Users/lyaotian/Documents/Web/feathers/test1/src/database/define',
    force_output: true,
});
//# sourceMappingURL=run.js.map