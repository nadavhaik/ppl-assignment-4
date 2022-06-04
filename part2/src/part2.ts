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
    let d: { [key: string]: T} = {}
    let initialized: boolean = false
    sync().then((table: Table<T>) => {
        for (const key in table)
            d[key] = table[key]
        initialized = true
    })
    const waitForInitialization = () => {while(!initialized);}

    return {
        get(key: string): Promise<T> {
            return sync()
                .then(() => {
                    waitForInitialization()
                    if(d.hasOwnProperty(key))
                        return Promise.resolve(d[key])
                    return Promise.reject(MISSING_KEY)
                }).catch(() => Promise.reject(MISSING_KEY))
        },
        set(key: string, val: T): Promise<void> {
            return sync().then(() => {
                waitForInitialization()
                d[key] = val
                return Promise.resolve()
            }).catch(() => Promise.reject(MISSING_KEY))
        },
        delete(key: string): Promise<void> {
           return sync().then(() => {
               waitForInitialization()
               if(d.hasOwnProperty(key)) {
                   delete d[key]
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

        let obj = await tables[ref.table].get(ref.key)
        let newObj: any = {}

        for(const [key, val] of Object.entries(obj)) {
            if(isReference(val))
                newObj[key] = await deref(val)
            else
                newObj[key] = val
        }

        return Promise.resolve(newObj)
    }

    return deref(ref)
}

// Q 2.3

export function lazyProduct<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* () {
        // TODO implement!
    }
}

export function lazyZip<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* () {
        // TODO implement!
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

    const handleMutation = async (newTable: Table<T>) => {
        // TODO implement!
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
            return handleMutation(null as any /* TODO */)
        },
        delete(key: string): Promise<void> {
            return handleMutation(null as any /* TODO */)
        },

        subscribe(observer: (table: Table<T>) => void): void {
            // TODO implement!
        }
    }
}