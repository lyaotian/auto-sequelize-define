import fs = require('fs-extra')
import util = require('util')
import stream = require('stream')
import Model = require('./Model')
import Field = require('./Field')
import * as mustache from 'mustache'
import path = require('path')
const root = path.resolve(__dirname, "../")
const es = require('event-stream')

const TABLE_START = 'CREATE TABLE `'
const PRIMARY_START = 'PRIMARY KEY (`'

interface Options {
    input_sql_file: string
    output_dir: string
    force_output: boolean
}

let outDir = root + '/output'

//   `account` varchar(16) NOT NULL DEFAULT '' COMMENT '账号',
//   `length` tinyint(1) NOT NULL DEFAULT '4' COMMENT '账号位数',
//   `is_sold` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已售出',
//   `is_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT '账号是否已使用',
//   `used_by_wholesaler_id` int(11) NOT NULL DEFAULT '0' COMMENT '使用的批发商id',
//   `used_by_account_id` int(11) NOT NULL DEFAULT '0' COMMENT '激活后对应的账号id',
//   `update_time` bigint(20) NOT NULL DEFAULT '0' COMMENT '更新时间戳',

const getFieldType = (input: string): string => {
    if (input.startsWith('tinyint')) {
        return 'int8'
    } else if (input == 'timestamp') {
        return 'time.Time'
    } else if (input.startsWith('bigint')) {
        return 'int64'
    } else if (input.startsWith('varchar') || input.startsWith('char') || input.indexOf('text') >= 0) {
        return 'string'
    } else if (input.indexOf('int') >= 0) {
        return 'int'
    } else if (input.startsWith('decimal') || input.indexOf('float') >= 0) {
        return 'float32'
    } else if (input.indexOf('double') >= 0) {
        return 'float64'
    }
    throw new Error('unknow type')
}

const toFields = (lines: string[]): Field[] => {
    let fields: Field[] = []
    for (let line of lines) {
        if (!line.startsWith(PRIMARY_START)) {
            let f = new Field()
            let array = line.split(' ')
            f.name = toCamelName(array[0].substring(1, array[0].length - 1))
            f.type = getFieldType(array[1])
            f.sqlType = array[1]
            f.isNullable = line.indexOf('NOT NULL') < 0
            let defaultValueIndex = array.findIndex(item => item == 'DEFAULT')
            if (defaultValueIndex >= 0) {
                f.defaultValue = array[array.findIndex(item => item == 'DEFAULT') + 1]
                if (f.defaultValue.endsWith(',')) {
                    f.defaultValue = f.defaultValue.substring(0, f.defaultValue.length - 1)
                }
                if (f.defaultValue.startsWith("'") && f.defaultValue.endsWith("'")) {
                    f.defaultValue = f.defaultValue.substring(1, f.defaultValue.length - 1)
                }
            }
            let commentIndex = array.findIndex(item => item == 'COMMENT')
            if (commentIndex >= 0) {
                f.comment = array[array.findIndex(item => item == 'COMMENT') + 1]
                if (f.comment.endsWith(',')) {
                    f.comment = f.comment.substring(1, f.comment.length - 1)
                }
                f.comment = f.comment.replace(/"/g, '')
                f.comment = f.comment.replace(/'/g, '')
            }
            fields.push(f)
        }
    }

    for (let line of lines) {
        if (line.startsWith(PRIMARY_START)) {
            fields.map(item => {
                let pStart = PRIMARY_START.length
                let primaryKey = line.substring(pStart, pStart + 2)
                item.isPrimaryKey = (item.name == primaryKey)
                return item
            })
        }
    }
    return fields
}

const toModels = (map: Map<string, string[]>): Model[] => {
    let models: Model[] = []
    for (let key of map.keys()) {
        let value = map.get(key)
        let model = new Model()
        model.table = key.substring('tb_'.length, key.length)
        model.fields = toFields(value || []).filter(v => {return v.name != 'Id' && v.name != 'CreateTime' && v.name != 'UpdateTime'})
        if (model.table == 'coupon') {
            console.log('')
        }
        models.push(model)
    }
    return models
}

function toCamelName(input = '', divide = '_'): string {
    let result = input;
    let divideIndex = input.indexOf(divide);
    if (divideIndex == 0) {
        return toCamelName(input.substring(1), divide);
    }
    if (divideIndex >= 0) {
        result = '';
        let items = input.split(divide);
        let count = items.length;
        for (let i = 0; i < count; i++) {
            let item = items[i];
            if (item.length > 0) {
                let firstChar = item.substr(0, 1);
                result += ((i == 0 ? firstChar.toUpperCase() : firstChar.toUpperCase()) + item.substring(1));
            } else {
                result += item;
            }
        }
    } else {
        result = result.substr(0, 1).toUpperCase() + result.substring(1);
    }
    return result;
}

const toCodes = (model: Model): void => {
    let template = fs.readFileSync(root + '/src/define.mustache', 'utf8')
    let code = mustache.render(template, { ...model, ...{name: toCamelName(model.table)} })
    fs.writeFileSync(`${outDir}/${model.table}.go`, code)
}

const copyTo = (dir: string, isForce = false) => {
    let fromFiles = fs.readdirSync(outDir)
    let toFiles = fs.readdirSync(dir)
    fromFiles.forEach(fileName => {
        if (!isForce && toFiles.some(to => to == fileName)) {{
            console.log('file ' + fileName + ' exists, skipped!!')
        }} else {
            fs.copySync(outDir + '/' + fileName, dir + '/' + fileName)
        }
    })
}

export = {
    run: (options: Options) => {
        // copyTo(options.output_dir)
    
        const map = new Map<string, string[]>()
        let lineCount = 0;
        let readingTable: string = ''
        fs.createReadStream(options.input_sql_file)
            .pipe(es.split())
            .pipe(es.mapSync((line: string) => {
                line = line.trim()
                if (line.startsWith(TABLE_START)) {
                    let start = TABLE_START.length
                    let end = line.lastIndexOf('`')
                    readingTable = line.substring(start, end)
                    map.set(readingTable, [])
                } else {
                    if (readingTable.length > 0) {
                        if (line.startsWith('`') || line.startsWith(PRIMARY_START)) {
                            let properties: string[] | undefined = map.get(readingTable)
                            if (properties) {
                                properties.push(line)
                            }
                        } else {
                            readingTable = ''
                        }
                    }
                }
    
                lineCount += 1;
            })
                .on('error', function () {
                    console.log('Error while reading file.' + lineCount);
                })
                .on('end', function () {
                    fs.emptyDirSync(outDir)
                    toModels(map).map(model => {
                        toCodes(model)
                    })
                    // copyTo(options.output_dir, options.force_output)
                    console.log('Read entire file. lineCount=' + lineCount)
                })
            );
    }
}