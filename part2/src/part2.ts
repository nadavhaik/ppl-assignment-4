export const MISSING_KEY = '___MISSING_KEY___'
export const MISSING_TABLE_SERVICE = '___MISSING_TABLE_SERVICE___'

export type Table<T> = Readonly<Record<string, Readonly<T>>>

export type TableService<T> = {
    get(key: string): Promise<T>;
    set(key: string, val: T): Promise<void>;
    delete(key: string): Promise<void>;
}

// Q 2.1 (a)
export function makeTableService<T>(sync: (table?: Table<T>) => Promise<Table<T>>): TableService<T> {
    // optional initialization code
    let _newTable: Record<string, T> = {}
    let _initialized: boolean = false
    sync().then((table: Table<T>) => {
        for (const key in table)
            _newTable[key] = table[key]
        _initialized = true
    })
    const waitForInitialization = () => {while(!_initialized);}

    return {
        get(key: string): Promise<T> {
            return sync(_newTable)
                .then(() => {
                    waitForInitialization()
                    if(_newTable.hasOwnProperty(key))
                        return Promise.resolve(_newTable[key])
                    return Promise.reject(MISSING_KEY)
                }).catch(() => Promise.reject(MISSING_KEY))
        },
        set(key: string, val: T): Promise<void> {
            return sync(_newTable).then(() => {
                waitForInitialization()
                _newTable[key] = val
                return Promise.resolve()
            }).catch(() => Promise.reject(MISSING_KEY))
        },
        delete(key: string): Promise<void> {
           return sync(_newTable).then(() => {
               waitForInitialization()
               if(_newTable.hasOwnProperty(key)) {
                   delete _newTable[key]
                   return Promise.resolve()
               }
               return Promise.reject(MISSING_KEY)
           }).catch(() => Promise.reject(MISSING_KEY))
        }
    }
}

// Q 2.1 (b)
export function getAll<T>(store: TableService<T>, keys: string[]): Promise<T[]> {
    return Promise.all(keys.map((key: string) => store.get(key)))
}


// Q 2.2
export type Reference = { table: string, key: string }

export type TableServiceTable = Table<TableService<object>>

export function isReference<T>(obj: T | Reference): obj is Reference {
    return typeof obj === 'object' && 'table' in obj
}

export async function constructObjectFromTables(tables: TableServiceTable, ref: Reference) {
    async function deref(ref: Reference) {
        if(!tables.hasOwnProperty(ref.table))
            return Promise.reject(MISSING_TABLE_SERVICE)

        let obj: any = await tables[ref.table].get(ref.key)
        for(const [key, val] of Object.entries(obj).filter(([key, val]) => isReference(val)))
            obj[key] = await deref(val as Reference)

        return Promise.resolve(obj)
    }

    return deref(ref)
}

// Q 2.3

export function lazyProduct<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* (): Generator<[T1, T2]>  {
        for (const t1 of g1()) {
            for(const t2 of g2())
                yield [t1, t2]
        }
    }
}

export function lazyZip<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* (): Generator<[T1, T2]> {
        const gen1: Generator<T1> = g1()
        const gen2: Generator<T2> = g2()

        for (let [gen1Iter, gen2Iter]: [IteratorResult<T1>, IteratorResult<T2>] = [gen1.next(), gen2.next()];    // initialization
             !gen1Iter.done && !gen2Iter.done;                                                                  // loop condition
             gen1Iter = gen1.next(), gen2Iter = gen2.next()) {                                                  // loop step
            yield [gen1Iter.value, gen2Iter.value]                                                              // loop content - generator yields
        }
    }
}

// Q 2.4
export type ReactiveTableService<T> = {
    get(key: string): T;
    set(key: string, val: T): Promise<void>;
    delete(key: string): Promise<void>;
    subscribe(observer: (table: Table<T>) => void): void
}

export async function makeReactiveTableService<T>(sync: (table?: Table<T>) => Promise<Table<T>>, optimistic: boolean): Promise<ReactiveTableService<T>> {
    // optional initialization code

    let _table: Table<T> = await sync()
    let _observers: ((table: Table<T>) => void)[] = []
    const handleMutation = async (newTable: Table<T>) => {
        if(optimistic) {
            _observers.map((observer) => observer(newTable))
            return sync(newTable).then(() => {_table = newTable}).catch((err) => {
                _observers.map((observer) => observer(_table))
                throw err
            })
        } // else - not optimistic:
        return sync(newTable).then(() => {
            _table = newTable
            _observers.map((observer) => observer(newTable))
        })
    }
    return {
        get(key: string): T {
            if (key in _table) {
                return _table[key]
            } else {
                throw MISSING_KEY
            }
        },
        set(key: string, val: T): Promise<void> {
            const oldTable = _table;
            let newTable: Record<string, T> = {}
            for(const [oldKey, oldVal] of Object.entries(oldTable))
                newTable[oldKey] = oldVal
            newTable[key] = val
            return handleMutation(newTable)
        },
        delete(key: string): Promise<void> {
            const oldTable = _table;
            if(!(key in oldTable)) {
                return Promise.reject(MISSING_KEY)
            }
            let newTable: Record<string, T> = {}
            for(const [tableKey, tableVal] of Object.entries(oldTable)) {
                    if(tableKey != key)
                        newTable[tableKey] = tableVal
            }
            return handleMutation(newTable)
        },
        subscribe(observer: (table: Table<T>) => void): void {
            _observers.push(observer)
        }
    }
}