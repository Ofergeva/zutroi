"use strict"

let f = {};
f.DB = function (type, file = false) {
    this.db = require(type);
    if(type == 'sqlite3'){
        this.db.verbose();
        this.instane = new this.db.Database(`${file}.db`, this.db.OPEN_CREATE | this.db.OPEN_READWRITE,(err) => {
            if(err) console.log(err.message);
        });
    }
};

f.Set = function (name, db, fields = null) {
    this.name = name;
    this.fields = {};
    this.keys = {};
    for(let x in fields) {
        let fixed = x.replace(/\s/g,'_');
        this.keys[fixed] = x;
        this.fields[fixed] = fields[x];
    }
    this.db = db.instane;
    this.render = () => {
        let db = this.db;
        let qArray = [];
        qArray.push('CREATE TABLE IF NOT EXISTS');
        qArray.push(this.name);
        let columns = [];
        for(let x in this.fields) {
            switch (this.fields[x]) {
                case 'string':
                    columns.push(`${x} VARCHAR(255)`);
                    break;
                default:
                    columns.push(`${x} ${this.fields[x].toUpperCase()}`);
                    break;
            }
        }
        qArray.push(columns);
        db.serialize(function() {
            let q = generateQuery(qArray,{ addQuote: false, addBrackets: true });
            console.log(q);
            db.run(q);
        });
    }
    this.push = (record) => {
        let db = this.db;
        let qArray = [];
        qArray.push('INSERT INTO');
        qArray.push(this.name);
        let columns = [];
        let values = [];
        for(let x in record) {
            columns.push(x);
            if(record[x] === null)
                values.push('null');
            else
                values.push(record[x]);
        }
        if(record[0] === undefined) qArray.push(columns);
        qArray.push('VALUES');
        qArray.push(values);
        db.serialize(function() {
            let q = generateQuery(qArray);
            console.log(q);
            db.run(q);
        });
    }
    this.render();
}

f.RecordSet = function (db) {
    this.db = db.instane;
    this._set = null;
    this._join = [];
    this._fields = null;
    this._filters = null;
    this._data = null;
    this.set = (set) => {
        this._set = set;
        return this;
    }
    this.intersect = (set,onOne,onTwo) => {
        this._join.push(['intersect', set, onOne, onTwo]);
        return this;
    }
    this.rUnion = (set,onOne,onTwo) => {
        this._join.push(['r_union', set, onOne, onTwo]);
        return this;
    }
    this.lUnion = (set,onOne,onTwo) => {
        this._join.push(['l_union', set, onOne, onTwo]);
        return this;
    }
    this.union = (set,onOne,onTwo) => {
        this._join.push(['union', set, onOne, onTwo]);
        return this;
    }
    this.fields = (fields) => {
        this._fields = fields;
        return this;
    }
    this.filters = (filters) => {
        this._filters = filters;
        return this;
    }
    this.go = (limit = false, callback) => {
        let db = this.db;
        let self = this;
        let qArray = [];
        qArray.push('SELECT');
        qArray.push(this._fields ? this._fields : '*');
        qArray.push('FROM');
        qArray.push(this._set.name);
        for(let x in this._join) {
            switch (this._join[x][0]) {
                case 'intersect':
                    qArray.push('INNER JOIN');
                    break;
                case 'l_unoin':
                    qArray.push('LEFT JOIN');
                    break;
                case 'r_unoin':
                    qArray.push('RIGHT JOIN');
                    break;
                case 'unoin':
                    qArray.push('FULL JOIN');
                    break;
                default:
                    qArray.push('JOIN');
                    break;
            }
            qArray.push(this._join[x][1].name);
            qArray.push('ON');
            qArray.push(`${this._set.name}.`);
            qArray.push((this._join[x][2] == this._join[x][0] || this._join[x][2] == this._join[x][1]) ? 'rowid' : this._join[x][2]);
            qArray.push('=');
            qArray.push(`${this._join[x][1].name}.`);
            qArray.push((this._join[x][3] == this._join[x][0] || this._join[x][3] == this._join[x][1]) ? 'rowid' : this._join[x][3]); 
        }
        if(typeof limit === 'number') qArray.push(`LIMIT ${limit}`);

        let q = generateQuery(qArray,{addQuote: false, addBrackets: false});
        console.log(q);
        db.serialize(function() {
            let results = db.all(q, [], (err, rows) => {
                if(err) 
                    console.log(err); 

                self._data =  rows;
                callback(rows);
            });
        });
    }
}

function generateQuery (qArray,options = { addQuote: true, addBrackets: true }) {
    let q = '';
    for(let x in qArray){
        if(typeof qArray[x] === 'string' || typeof qArray[x] === 'number'){
            q += `${qArray[x]}`;
            if(qArray[x][qArray[x].length-1] !== String.fromCharCode(46))
                q += String.fromCharCode(32);
        }else{
            let t = `${qArray[x].map((value,index) => { return (typeof value === 'string' && value !== 'null' && options.addQuote) ? '\''+value+'\'' : value }).join(',')} `;
            if(options.addBrackets) t = `(${t})`;
            q += t;
        }
    }
    return q;
}
module.exports = f;