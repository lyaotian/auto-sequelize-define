"use strict";
const fs = require("fs-extra");
const Model = require("./Model");
const Field = require("./Field");
const mustache = require("mustache");
const path = require("path");
const root = path.resolve(__dirname, "../");
const es = require('event-stream');
const TABLE_START = 'CREATE TABLE `';
const PRIMARY_START = 'PRIMARY KEY (`';
let outDir = root + '/output';
//   `account` varchar(16) NOT NULL DEFAULT '' COMMENT '账号',
//   `length` tinyint(1) NOT NULL DEFAULT '4' COMMENT '账号位数',
//   `is_sold` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已售出',
//   `is_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT '账号是否已使用',
//   `used_by_wholesaler_id` int(11) NOT NULL DEFAULT '0' COMMENT '使用的批发商id',
//   `used_by_account_id` int(11) NOT NULL DEFAULT '0' COMMENT '激活后对应的账号id',
//   `update_time` bigint(20) NOT NULL DEFAULT '0' COMMENT '更新时间戳',
const getFieldType = (input) => {
    if (input == 'tinyint(1)') {
        return 'Sequelize.BOOLEAN';
    }
    else if (input == 'timestamp') {
        return 'Sequelize.DATE';
    }
    else if (input.startsWith('bigint')) {
        return 'Sequelize.BIGINT';
    }
    else if (input.indexOf('char') >= 0) {
        return 'Sequelize.STRING';
    }
    else if (input.indexOf('text') >= 0) {
        return 'Sequelize.TEXT';
    }
    else if (input.indexOf('int') >= 0) {
        return 'Sequelize.INTEGER';
    }
    else if (input.indexOf('float') >= 0) {
        return 'Sequelize.FLOAT';
    }
    else if (input.indexOf('double') >= 0) {
        return 'Sequelize.DOUBLE';
    }
    throw new Error('unknow type');
};
const toFields = (lines) => {
    let fields = [];
    for (let line of lines) {
        if (!line.startsWith(PRIMARY_START)) {
            let f = new Field();
            let array = line.split(' ');
            f.name = array[0].substring(1, array[0].length - 1);
            f.type = getFieldType(array[1]);
            f.isNullable = line.indexOf('NOT NULL') < 0;
            f.defaultValue = array[array.findIndex(item => item == 'DEFAULT') + 1];
            f.comment = array[array.findIndex(item => item == 'COMMENT') + 1];
            fields.push(f);
        }
    }
    for (let line of lines) {
        if (line.startsWith(PRIMARY_START)) {
            fields.map(item => {
                let pStart = PRIMARY_START.length;
                let primaryKey = line.substring(pStart, pStart + 2);
                item.isPrimaryKey = (item.name == primaryKey);
                return item;
            });
        }
    }
    return fields;
};
const toModels = (map) => {
    let models = [];
    for (let key of map.keys()) {
        let value = map.get(key);
        let model = new Model();
        model.table = key.substring(3, key.length);
        if (model.table == 'admin_user') {
            console.log('');
        }
        model.fields = toFields(value || []);
        models.push(model);
    }
    return models;
};
const toCodes = (model) => {
    let template = fs.readFileSync(root + '/src/define.mustache', 'utf8');
    let code = mustache.render(template, Object.assign({}, model));
    fs.writeFileSync(`${outDir}/${model.table}.ts`, code);
};
const copyTo = (dir, isForce = false) => {
    let fromFiles = fs.readdirSync(outDir);
    let toFiles = fs.readdirSync(dir);
    fromFiles.forEach(fileName => {
        if (!isForce && toFiles.some(to => to == fileName)) {
            {
                console.log('file ' + fileName + ' exists, skipped!!');
            }
        }
        else {
            fs.copySync(outDir + '/' + fileName, dir + '/' + fileName);
        }
    });
};
module.exports = {
    run: (options) => {
        // copyTo(options.output_dir)
        const map = new Map();
        let lineCount = 0;
        let readingTable = '';
        fs.createReadStream(options.input_sql_file)
            .pipe(es.split())
            .pipe(es.mapSync((line) => {
            line = line.trim();
            if (line.startsWith(TABLE_START)) {
                let start = TABLE_START.length;
                let end = line.lastIndexOf('`');
                readingTable = line.substring(start, end);
                map.set(readingTable, []);
            }
            else {
                if (readingTable.length > 0) {
                    if (line.startsWith('`') || line.startsWith(PRIMARY_START)) {
                        let properties = map.get(readingTable);
                        if (properties) {
                            properties.push(line);
                        }
                    }
                    else {
                        readingTable = '';
                    }
                }
            }
            lineCount += 1;
        })
            .on('error', function () {
            console.log('Error while reading file.' + lineCount);
        })
            .on('end', function () {
            fs.emptyDirSync(outDir);
            toModels(map).map(model => toCodes(model));
            copyTo(options.output_dir, options.force_output);
            console.log('Read entire file. lineCount=' + lineCount);
        }));
    }
};
//# sourceMappingURL=index.js.map