declare module 'auto-sequelize-define' {
    interface Options {
    input_sql_file: string
    output_dir: string
    force_output: boolean
    }

    export function run(options: Options): void
}