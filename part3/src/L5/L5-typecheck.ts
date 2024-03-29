// L5-typecheck
// ========================================================
import {equals, filter, flatten, includes, map, intersection, zipWith, reduce, concat} from 'ramda';
import {
    isAppExp, isBoolExp, isDefineExp, isIfExp, isLetrecExp, isLetExp, isNumExp,
    isPrimOp, isProcExp, isProgram, isStrExp, isVarRef, unparse, parseL51,
    AppExp, BoolExp, DefineExp, Exp, IfExp, LetrecExp, LetExp, NumExp, SetExp, LitExp,
    Parsed, PrimOp, ProcExp, Program, StrExp, isSetExp, isLitExp,
    isDefineTypeExp, isTypeCaseExp, DefineTypeExp, TypeCaseExp, CaseExp, isCompoundExp, makeBoolExp, VarDecl
} from "./L5-ast";
import { applyTEnv, makeEmptyTEnv, makeExtendTEnv, TEnv } from "./TEnv";
import {
    isProcTExp,
    makeBoolTExp,
    makeNumTExp,
    makeProcTExp,
    makeStrTExp,
    makeVoidTExp,
    parseTE,
    unparseTExp,
    Record,
    BoolTExp,
    NumTExp,
    StrTExp,
    TExp,
    VoidTExp,
    UserDefinedTExp,
    isUserDefinedTExp,
    UDTExp,
    isNumTExp,
    isBoolTExp,
    isStrTExp,
    isVoidTExp,
    isRecord,
    ProcTExp,
    makeUserDefinedNameTExp,
    Field,
    makeAnyTExp,
    isAnyTExp,
    isUserDefinedNameTExp,
    isAtomicTExp,
    isLitTexp,
    LitTexp,
    makeLitTexp,
    isCompoundTExp,
    extractTypeNames,
    makeTVar,
    eqAtomicTExp,
    isTVar,
    tvarDeref,
    eqTVar,
    TVar
} from "./TExp";
import { isEmpty, allT, first, rest, cons } from '../shared/list';
import {
    Result,
    makeFailure,
    bind,
    makeOk,
    zipWithResult,
    mapv,
    mapResult,
    isFailure,
    either,
    isOk
} from '../shared/result';
import {isEmptySExp, isSymbolSExp, makeSymbolSExp} from "./L5-value";

// L51
export const getTypeDefinitions = (p: Program): UserDefinedTExp[] => {
    const iter = (head: Exp, tail: Exp[]): UserDefinedTExp[] =>
        isEmpty(tail) && isDefineTypeExp(head) ? [head.udType] :
        isEmpty(tail) ? [] :
        isDefineTypeExp(head) ? cons(head.udType, iter(first(tail), rest(tail))) :
        iter(first(tail), rest(tail));
    return isEmpty(p.exps) ? [] :
        iter(first(p.exps), rest(p.exps));
}

// L51
export const getDefinitions = (p: Program): DefineExp[] => {
    const iter = (head: Exp, tail: Exp[]): DefineExp[] =>
        isEmpty(tail) && isDefineExp(head) ? [head] :
        isEmpty(tail) ? [] :
        isDefineExp(head) ? cons(head, iter(first(tail), rest(tail))) :
        iter(first(tail), rest(tail));
    return isEmpty(p.exps) ? [] :
        iter(first(p.exps), rest(p.exps));
}

// L51
export const getRecords = (p: Program): Record[] =>
    flatten(map((ud: UserDefinedTExp) => ud.records, getTypeDefinitions(p)));

// L51
export const getItemByName = <T extends {typeName: string}>(typeName: string, items: T[]): Result<T> =>
    isEmpty(items) ? makeFailure(`${typeName} not found`) :
    first(items).typeName === typeName ? makeOk(first(items)) :
    getItemByName(typeName, rest(items));

// L51
export const getUserDefinedTypeByName = (typeName: string, p: Program): Result<UserDefinedTExp> =>
    getItemByName(typeName, getTypeDefinitions(p));

// L51
export const getRecordByName = (typeName: string, p: Program): Result<Record> =>
    getItemByName(typeName, getRecords(p));

// L51
// Given the name of record, return the list of UD Types that contain this record as a case.
export const getRecordParents = (typeName: string, p: Program): UserDefinedTExp[] =>
    filter((ud: UserDefinedTExp): boolean => map((rec: Record) => rec.typeName, ud.records).includes(typeName),
        getTypeDefinitions(p));


// L51
// Given a user defined type name, return the Record or UD Type which it names.
// (Note: TS fails to type check either in this case)
export const getTypeByName = (typeName: string, p: Program): Result<UDTExp> => {
    const ud = getUserDefinedTypeByName(typeName, p);
    if (isFailure(ud)) {
        return getRecordByName(typeName, p);
    } else {
        return ud;
    }
}


// Is te1 a subtype of te2?
const isSubType = (te1: TExp, te2: TExp, p: Program): boolean =>
    isAnyTExp(te2) ? true :
    isUserDefinedNameTExp(te1) && isUserDefinedNameTExp(te2) ?
        te1.typeName === te2.typeName ? true : //same user defined name TExp
            map((t:TExp):string =>isUserDefinedNameTExp(t)? t.typeName: 'xxxxxxx',getParentsType(te1,p)).includes(te2.typeName) ? true : false :
    isTVar(te1)&&isTVar(te2)&&eqTVar(te1,te2) ? true : //same TVars
    tvarDeref(te1) === tvarDeref(te2) ? true : false





// Purpose: Check that the computed type te1 can be accepted as an instance of te2
// test that te1 is either the same as te2 or more specific
// Deal with case of user defined type names 
// Exp is only passed for documentation purposes.
// p is passed to provide the context of all user defined types
export const checkEqualType = (te1: TExp, te2: TExp, exp: Exp, p: Program): Result<TExp> =>
    isAnyTExp(te2) ? makeOk(te2) :
        equals (te1,te2) ? makeOk(te2) :
            isSubType(te1,te2,p) ? makeOk(te2) :
                makeFailure(`Incompatible types: ${te1} and ${te2} in ${exp}`)


// L51
// Return te and its parents in type hierarchy to compute type cover
// Return type names (not their definition)
export const getParentsType = (te: TExp, p: Program): TExp[] =>
    (isNumTExp(te) || isBoolTExp(te) || isStrTExp(te) || isVoidTExp(te) || isAnyTExp(te)) ? [te] :
    isProcTExp(te) ? [te] :
    isUserDefinedTExp(te) ? [te] :
    isRecord(te) ? getParentsType(makeUserDefinedNameTExp(te.typeName), p) :
    isUserDefinedNameTExp(te) ?
        either(getUserDefinedTypeByName(te.typeName, p),
                (ud: UserDefinedTExp) => [makeUserDefinedNameTExp(ud.typeName)],
                (_) => either(getRecordByName(te.typeName, p),
                            (rec: Record) => cons(makeUserDefinedNameTExp(rec.typeName), 
                                                  map((ud) => makeUserDefinedNameTExp(ud.typeName), 
                                                      getRecordParents(rec.typeName, p))),
                            (_) => [])) : 
    [];

// L51
// Get the list of types that cover all ts in types.
export const coverTypes = (types: TExp[], p: Program): TExp[] =>  {
    // [[p11, p12], [p21], [p31, p32]] --> types in intersection of all lists
    const parentsList : TExp[][] = map((t) => getParentsType(t,p), types);
    return reduce<TExp[], TExp[]>(intersection, first(parentsList), rest(parentsList));
}

// Return the most specific in a list of TExps
// For example given UD(R1, R2):
// - mostSpecificType([R1, R2, UD]) = R1 (choses first out of record level)
// - mostSpecificType([R1, number]) = number  
export const mostSpecificType = (types: TExp[], p: Program): TExp =>
    reduce((min: TExp, element: TExp) => isSubType(element, min, p) ? element : min, 
            makeAnyTExp(),
            types);

// L51
// Check that all t in types can be covered by a single parent type (not by 'any')
// Return most specific parent
export const checkCoverType = (types: TExp[], p: Program): Result<TExp> => {
    const cover = coverTypes(types, p);
    return isEmpty(cover) ? makeFailure(`No type found to cover ${map((t) => JSON.stringify(unparseTExp(t), null, 2), types).join(" ")}`) :
    makeOk(mostSpecificType(cover, p));
}


// Compute the initial TEnv given user defined types
// =================================================

// Construct type environment for the user-defined type induced functions
// Type constructor for all records
// Type predicate for all records
// Type predicate for all user-defined-types
// All globally defined variables (with define)



// TOODO L51
// Initialize TEnv with:
// * Type of global variables (define expressions at top level of p)
// * Type of implicitly defined procedures for user defined types (define-type expressions in p)
export const initTEnv = (p: Program): TEnv => {
    let vars: string[] = []
    let texps: TExp[] = []


    //add globals
    let global_defs:DefineExp[] = getDefinitions(p)
    let global_vars:string[] = map((d:DefineExp)=>d.var.var,global_defs)
    let global_texps:TExp[]=map((d:DefineExp)=>d.var.texp,global_defs)
    vars = concat(vars,global_vars)
    texps = concat(texps,global_texps)

    //add user-defined
    let type_defs:UserDefinedTExp[] = getTypeDefinitions(p)

    let ud_names:string[] = map((u:UserDefinedTExp)=>u.typeName,type_defs)
    let ud_types:TExp[] = map((u:UserDefinedTExp)=>makeUserDefinedNameTExp(u.typeName),type_defs)
    vars = concat(vars,ud_names)
    texps = concat(texps,ud_types)


    let user_def_preds: string[] = map((td:UserDefinedTExp)=>td.typeName+"?",type_defs)
    let user_def_pred_texps: TExp[] = map((td:UserDefinedTExp)=>makeProcTExp([makeAnyTExp()],makeBoolTExp()),type_defs)
    vars = concat(vars,user_def_preds)
    texps = concat(texps,user_def_pred_texps)


    //add records
    const records:Record[] = getRecords(p)
    let records_names:string [] = map((r:Record)=>r.typeName,records)
    let records_uds_names:TExp [] = map((r:Record)=>makeUserDefinedNameTExp(r.typeName),records)
    vars = concat(vars,records_names)
    texps = concat(texps,records_uds_names)


    let records_preds :string[] = map((r:Record)=>r.typeName+"?",records)
    let records_preds_texps:TExp[] = map((r:Record)=>makeProcTExp([makeAnyTExp()],makeBoolTExp()),records)
    vars = concat(vars,records_preds)
    texps = concat(texps,records_preds_texps)
    let records_cons :string[] = map((r:Record)=>"make-"+r.typeName,getRecords(p))
    let records_cons_texps:TExp[] =
        map((r:Record)=>makeProcTExp(map((f:Field)=>f.te,r.fields),makeUserDefinedNameTExp(r.typeName)),records)
    vars = concat(vars,records_cons)
    texps = concat(texps,records_cons_texps)

    return makeExtendTEnv(vars,texps,makeEmptyTEnv())
};



// Verify that user defined types and type-case expressions are semantically correct
// =================================================================================


//we added
const compareFields = (r1:Record,r2:Record) : boolean => {
    const fields1 = r1.fields
    const fields2 = r2.fields

    if (fields1.length!=fields2.length) return false

    for (let i=0;i<fields1.length;i++){
        let found_same_field:boolean = false
        for(let j=0;j<(!found_same_field&&fields2.length);j++){
            if(fields1[i].fieldName===fields2[j].fieldName){
                found_same_field=true
                if (fields1[i].te!=fields2[j].te) return false
            }
        }
        if(!found_same_field) return false
    }

    return true
}

// we added
const hasBaseCase = (udt:UserDefinedTExp) : boolean => {
    const records: Record[] = udt.records
    for(let i=0;i<records.length;i++){
        if(records[i].fields.length===0) return true
    }
    return false
}

const checkUserDefinedTypes = (p: Program): Result<true> => {
    const records: Record[] = getRecords(p)
    // If the same type name is defined twice with different definitions
    let i:number
    let j:number
    for (i=0;i<records.length;i++){
        for(j=0;j<records.length;j++){
            if(i!=j&&records[i].typeName===records[j].typeName){
                if(!compareFields(records[i],records[j]))
                    return makeFailure("2 records with the same name don't match")
            }
        }
    }
    // If a recursive type has no base case
    const user_defined_types:UserDefinedTExp[] = getTypeDefinitions(p)

    const get_udt_name = (x:any): string => isUserDefinedTExp(x)? x.typeName : ''

    for (i=0;i<user_defined_types.length;i++){
        const ud_records: Record[] = user_defined_types[i].records

        if(!hasBaseCase(user_defined_types[i])){
            for (j = 0; j < ud_records.length; j++) {
                const rec_fields: Field[] = ud_records[i].fields
                for (let k = 0; k < rec_fields.length; k++) {
                        if(isUserDefinedTExp(rec_fields[k])){
                            if(get_udt_name(rec_fields[k])===get_udt_name(user_defined_types[i]))
                                makeFailure("missing base case")
                        }
                }
            }
        }

    }
    return makeOk(true);
}


const checkTypeCase = (tc: TypeCaseExp, p: Program): Result<true> => {
    // Check that all type case expressions have exactly one clause for each constituent subtype 
    // (in any order)
    const records:Record[] = getRecords(p)
    let i: number
    let j:number

    //check there is only one case for every matching record
    for(i=0;i<tc.cases.length;i++){
        for(j=0;j<tc.cases.length;j++){
            if(i!=j&&tc.cases[i].typeName===tc.cases[j].typeName){
                return makeFailure("more than one clause for same subtype")
            }
        }
    }

    //check num of variable declarations match record's num of vars
    for(i=0;i<tc.cases.length;i++){
        let num_of_vars: number = tc.cases[i].varDecls.length
        let existingRecord:boolean = false
        for (j=0;j<(records.length&&!existingRecord);j++){
            if(records[j].typeName===tc.cases[i].typeName){
                existingRecord = true
                if(records[j].fields.length!=num_of_vars){
                    return makeFailure("num of vars in case doesn't match record")
                }
            }
        }
        if(!existingRecord){
            return makeFailure("record doesn't exists")
        }
    }
    return makeOk(true);
}


// Compute the type of L5 AST exps to TE
// ===============================================
// Compute a Typed-L5 AST exp to a Texp on the basis
// of its structure and the annotations it contains.

// Purpose: Compute the type of a concrete fully-typed expression
export const L51typeofProgram = (concreteExp: string): Result<string> =>
    bind(parseL51(concreteExp), (p: Program) =>
        bind(typeofExp(p, initTEnv(p), p), unparseTExp));

// For tests on a single expression - wrap the expression in a program
export const L51typeof = (concreteExp: string): Result<string> =>
    L51typeofProgram(`(L51 ${concreteExp})`);

// Purpose: Compute the type of an expression
// Traverse the AST and check the type according to the exp type.
// We assume that all variables and procedures have been explicitly typed in the program.
export const typeofExp = (exp: Parsed, tenv: TEnv, p: Program): Result<TExp> =>
    isNumExp(exp) ? makeOk(typeofNum(exp)) :
    isBoolExp(exp) ? makeOk(typeofBool(exp)) :
    isStrExp(exp) ? makeOk(typeofStr(exp)) :
    isPrimOp(exp) ? typeofPrim(exp) :
    isVarRef(exp) ? applyTEnv(tenv, exp.var) :
    isIfExp(exp) ? typeofIf(exp, tenv, p) :
    isProcExp(exp) ? typeofProc(exp, tenv, p) :
    isAppExp(exp) ? typeofApp(exp, tenv, p) :
    isLetExp(exp) ? typeofLet(exp, tenv, p) :
    isLetrecExp(exp) ? typeofLetrec(exp, tenv, p) :
    isDefineExp(exp) ? typeofDefine(exp, tenv, p) :
    isProgram(exp) ? typeofProgram(exp, tenv, p) :
    isSetExp(exp) ? typeofSet(exp, tenv, p) :
    isLitExp(exp) ? typeofLit(exp, tenv, p) :
    isDefineTypeExp(exp) ? typeofDefineType(exp, tenv, p) :
    isTypeCaseExp(exp) ? typeofTypeCase(exp, tenv, p) :
    makeFailure(`Unknown type: ${JSON.stringify(exp, null, 2)}`);

// Purpose: Compute the type of a sequence of expressions
// Check all the exps in a sequence - return type of last.
// Pre-conditions: exps is not empty.
export const typeofExps = (exps: Exp[], tenv: TEnv, p: Program): Result<TExp> =>
    isEmpty(rest(exps)) ? typeofExp(first(exps), tenv, p) :
    bind(typeofExp(first(exps), tenv, p), _ => typeofExps(rest(exps), tenv, p));

// a number literal has type num-te
export const typeofNum = (n: NumExp): NumTExp => makeNumTExp();

// a boolean literal has type bool-te
export const typeofBool = (b: BoolExp): BoolTExp => makeBoolTExp();

// a string literal has type str-te
const typeofStr = (s: StrExp): StrTExp => makeStrTExp();

// primitive ops have known proc-te types
const numOpTExp = parseTE('(number * number -> number)');
const numCompTExp = parseTE('(number * number -> boolean)');
const boolOpTExp = parseTE('(boolean * boolean -> boolean)');


export const typeofPrim = (p: PrimOp): Result<TExp> =>
    (p.op === '+') ? numOpTExp :
    (p.op === '-') ? numOpTExp :
    (p.op === '*') ? numOpTExp :
    (p.op === '/') ? numOpTExp :
    (p.op === 'and') ? boolOpTExp :
    (p.op === 'or') ? boolOpTExp :
    (p.op === '>') ? numCompTExp :
    (p.op === '<') ? numCompTExp :
    (p.op === '=') ? numCompTExp :
    // Important to use a different signature for each op with a TVar to avoid capture
    (p.op === 'number?') ? parseTE('(T -> boolean)') :
    (p.op === 'boolean?') ? parseTE('(T -> boolean)') :
    (p.op === 'string?') ? parseTE('(T -> boolean)') :
    (p.op === 'list?') ? parseTE('(T -> boolean)') :
    (p.op === 'pair?') ? parseTE('(T -> boolean)') :
    (p.op === 'symbol?') ? parseTE('(T -> boolean)') :
    (p.op === 'not') ? parseTE('(boolean -> boolean)') :
    (p.op === 'eq?') ? parseTE('(T1 * T2 -> boolean)') :
    (p.op === 'string=?') ? parseTE('(T1 * T2 -> boolean)') :
    (p.op === 'display') ? parseTE('(T -> void)') :
    (p.op === 'newline') ? parseTE('(Empty -> void)') :
    makeFailure(`Primitive not yet implemented: ${p.op}`);

//we added:  if thenTE and altTE equals return ok<altTe>
//otherwise, if thenTE and altTe has same cover type return ok<mostSpecificParent>
//otherwise, return failure
export const checkLegalAlt =(thenTE: TExp, altTE: TExp, exp:Exp, p:Program) : Result<TExp> => {
    const eq = checkEqualType(thenTE,altTE,exp,p)
    if(isOk(eq)){
        return eq
    }
    return checkCoverType([thenTE,altTE],p)
}


// Change this definition to account for possibility of subtype expressions between thenTE and altTE
// 
// Purpose: compute the type of an if-exp
// Typing rule:
//   if type<test>(tenv) = boolean
//      type<then>(tenv) = t1
//      type<else>(tenv) = t1
// then type<(if test then else)>(tenv) = t1
export const typeofIf = (ifExp: IfExp, tenv: TEnv, p: Program): Result<TExp> => {
    const testTE = typeofExp(ifExp.test, tenv, p);
    const thenTE = typeofExp(ifExp.then, tenv, p);
    const altTE = typeofExp(ifExp.alt, tenv, p);
    const constraint1 = bind(testTE, testTE => checkEqualType(testTE, makeBoolTExp(), ifExp, p));
    const constraint2 = bind(thenTE, (thenTE: TExp) =>
                            bind(altTE, (altTE: TExp) =>
                                checkLegalAlt(thenTE,altTE,ifExp,p)));
    return bind(constraint1, (_c1) => constraint2);
};

// Purpose: compute the type of a proc-exp
// Typing rule:
// If   type<body>(extend-tenv(x1=t1,...,xn=tn; tenv)) = t
// then type<lambda (x1:t1,...,xn:tn) : t exp)>(tenv) = (t1 * ... * tn -> t)
export const typeofProc = (proc: ProcExp, tenv: TEnv, p: Program): Result<TExp> => {
    const argsTEs = map((vd) => vd.texp, proc.args);
    const extTEnv = makeExtendTEnv(map((vd) => vd.var, proc.args), argsTEs, tenv);
    const constraint1 = bind(typeofExps(proc.body, extTEnv, p), (body: TExp) =>
                            checkEqualType(body, proc.returnTE, proc, p));
    return bind(constraint1, (returnTE: TExp) => makeOk(makeProcTExp(argsTEs, returnTE)));
};

// Purpose: compute the type of an app-exp
// Typing rule:
// If   type<rator>(tenv) = (t1*..*tn -> t)
//      type<rand1>(tenv) = t1
//      ...
//      type<randn>(tenv) = tn
// then type<(rator rand1...randn)>(tenv) = t
// We also check the correct number of arguments is passed.
export const typeofApp = (app: AppExp, tenv: TEnv, p: Program): Result<TExp> =>
    bind(typeofExp(app.rator, tenv, p), (ratorTE: TExp) => {
        if (! isProcTExp(ratorTE)) {
            return bind(unparseTExp(ratorTE), (rator: string) =>
                        bind(unparse(app), (exp: string) =>
                            makeFailure<TExp>(`Application of non-procedure: ${rator} in ${exp}`)));
        }
        if (app.rands.length !== ratorTE.paramTEs.length) {
            return bind(unparse(app), (exp: string) => makeFailure<TExp>(`Wrong parameter numbers passed to proc: ${exp}`));
        }
        const constraints = zipWithResult((rand, trand) => bind(typeofExp(rand, tenv, p), (typeOfRand: TExp) => 
                                                                checkEqualType(typeOfRand, trand, app, p)),
                                          app.rands, ratorTE.paramTEs);
        return mapv(constraints, _ => ratorTE.returnTE);
    });

// Purpose: compute the type of a let-exp
// Typing rule:
// If   type<val1>(tenv) = t1
//      ...
//      type<valn>(tenv) = tn
//      type<body>(extend-tenv(var1=t1,..,varn=tn; tenv)) = t
// then type<let ((var1 val1) .. (varn valn)) body>(tenv) = t
export const typeofLet = (exp: LetExp, tenv: TEnv, p: Program): Result<TExp> => {
    const vars = map((b) => b.var.var, exp.bindings);
    const vals = map((b) => b.val, exp.bindings);
    const varTEs = map((b) => b.var.texp, exp.bindings);
    const constraints = zipWithResult((varTE, val) => bind(typeofExp(val, tenv, p), (typeOfVal: TExp) => 
                                                            checkEqualType(varTE, typeOfVal, exp, p)),
                                      varTEs, vals);
    return bind(constraints, _ => typeofExps(exp.body, makeExtendTEnv(vars, varTEs, tenv), p));
};

// Purpose: compute the type of a letrec-exp
// We make the same assumption as in L4 that letrec only binds proc values.
// Typing rule:
//   (letrec((p1 (lambda (x11 ... x1n1) body1)) ...) body)
//   tenv-body = extend-tenv(p1=(t11*..*t1n1->t1)....; tenv)
//   tenvi = extend-tenv(xi1=ti1,..,xini=tini; tenv-body)
// If   type<body1>(tenv1) = t1
//      ...
//      type<bodyn>(tenvn) = tn
//      type<body>(tenv-body) = t
// then type<(letrec((p1 (lambda (x11 ... x1n1) body1)) ...) body)>(tenv-body) = t
export const typeofLetrec = (exp: LetrecExp, tenv: TEnv, p: Program): Result<TExp> => {
    const ps = map((b) => b.var.var, exp.bindings);
    const procs = map((b) => b.val, exp.bindings);
    if (! allT(isProcExp, procs))
        return makeFailure(`letrec - only support binding of procedures - ${JSON.stringify(exp, null, 2)}`);
    const paramss = map((p) => p.args, procs);
    const bodies = map((p) => p.body, procs);
    const tijs = map((params) => map((p) => p.texp, params), paramss);
    const tis = map((proc) => proc.returnTE, procs);
    const tenvBody = makeExtendTEnv(ps, zipWith((tij, ti) => makeProcTExp(tij, ti), tijs, tis), tenv);
    const tenvIs = zipWith((params, tij) => makeExtendTEnv(map((p) => p.var, params), tij, tenvBody),
                           paramss, tijs);
    const types = zipWithResult((bodyI, tenvI) => typeofExps(bodyI, tenvI, p), bodies, tenvIs)
    const constraints = bind(types, (types: TExp[]) => 
                            zipWithResult((typeI, ti) => checkEqualType(typeI, ti, exp, p), types, tis));
    return bind(constraints, _ => typeofExps(exp.body, tenvBody, p));
};

// Purpose: compute the type of a define
// Typing rule:
//   (define (var : texp) val)
//   tenv-val = extend-tenv(var:texp; tenv)
// If   type<val>(tenv-val) = texp
// then type<(define (var : texp) val)>(tenv) = void
export const typeofDefine = (exp: DefineExp, tenv: TEnv, p: Program): Result<VoidTExp> => {
    const v = exp.var.var;
    const texp = exp.var.texp;
    const val = exp.val;
    const tenvVal = makeExtendTEnv([v], [texp], tenv);
    const constraint = typeofExp(val, tenvVal, p);    
    return mapv(constraint, (_) => makeVoidTExp());
};

// Purpose: compute the type of a program
// Typing rule:
export const typeofProgram = (exp: Program, tenv: TEnv, p: Program): Result<TExp> =>
    typeofExps(exp.exps, tenv, p);


// Write the typing rule for DefineType expressions
export const typeofDefineType = (exp: DefineTypeExp, _tenv: TEnv, _p: Program): Result<TExp> =>
{
    const uds_correct:Result<true> =  checkUserDefinedTypes(_p)
    return bind(uds_correct,(v:true)=>makeOk(makeVoidTExp()))
}



export const typeofSet = (exp: SetExp, _tenv: TEnv, _p: Program): Result<TExp> =>
{
    const var1 = exp.var.var
    const val_texp = typeofExp(exp.val,_tenv,_p)
    const constraints = bind(val_texp,(t:TExp) => makeOk(makeTVar(var1.toString())))
    const change_TEnv = applyTEnv(_tenv,var1)
    return bind(change_TEnv,(t) => constraints)

};



export const typeofLit = (exp: LitExp, _tenv: TEnv, _p: Program): Result<TExp> =>
    makeOk(makeLitTexp())


// we added, get a case and return it's texp
export const get_type_of_case = (case_exp : CaseExp,tenv:TEnv,p:Program) : Result<TExp> => {
    const record = getRecordByName(case_exp.typeName,p);
    if(isFailure(record)){
        return record
    }
    const vars: string[] = case_exp.varDecls.map((v:VarDecl)=>v.var)
    const t_vars: TExp[] = record.value.fields.map((f:Field)=>f.te)
    const new_env:TEnv = makeExtendTEnv(vars,t_vars,tenv)
    return typeofExps(case_exp.body,new_env,p)
}



// Purpose: compute the type of a type-case
// Typing rule:
// For all user-defined-type id
//         with component records record_1 ... record_n
//         with fields (field_ij) (i in [1...n], j in [1..R_i])
//         val CExp
//         body_i for i in [1..n] sequences of CExp
//   ( type-case id val (record_1 (field_11 ... field_1r1) body_1)...  )
export const typeofTypeCase = (exp: TypeCaseExp, tenv: TEnv, p: Program): Result<TExp> => {
    const type_of_cases = mapResult((ce:CaseExp)=>get_type_of_case(ce,tenv,p),exp.cases)
    return bind(type_of_cases,(types)=>checkCoverType(types,p))
}
