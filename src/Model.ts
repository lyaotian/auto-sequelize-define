import Field = require('./Field')

class Model {
    public table = ''
    public fields: Field[] = []
}

export = Model