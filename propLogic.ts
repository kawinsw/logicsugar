// TODO: mapReduce
// TODO: transformation/translation/conversion in separate file --> build tools here (repeater, etc.)

// Later
// TODO: equivalence, validity, satisfiability in separate file
// TODO: memoization

import { Set } from "immutable";

abstract class Formula<T> {
  readonly formulaString: string;
  readonly dependencies: Set<number>;
  abstract evaluate(valuation: T[]): T;
  abstract matchForm(target: Formula<T>): boolean;

  constructor(formulaString: string, dependencies: Set<number>) {
    this.formulaString = formulaString;
    this.dependencies = dependencies;
  }

  toString(): string {
    return this.formulaString;
  }
}

const operandsToString = function (
  operands: Formula<unknown>[], 
  delimiters: string | string[]
): string {
  if (Array.isArray(delimiters)) {
    const strFunc = (phi: Formula<unknown>, i: number) => {
      return `${ delimiters[i] }${ phi.toString() }`;
    };
    if (delimiters.length === operands.length + 1) {
      const closing = delimiters[operands.length];
      return `${ operands.map(strFunc).join("") }${ closing }`;
    } else if (delimiters.length === operands.length) {
      if (operands.length === 1) {
        return `${ delimiters[0] }${ operands[0].toString() }`;
      } else {
        return `(${ operands.map(strFunc).join("") })`;
      }
    } else if (delimiters.length === operands.length - 1) {
      const remainder = operands.slice(1).map(strFunc).join("");
      return `(${ operands[0].toString() }${ remainder })`;
    } else {
      throw "Wrong number of connective symbols.";
    }
  } else if (operands.length === 0) {
    return delimiters;
  } else if (operands.length === 1) {
    return `${ delimiters }${ operands[0].toString() }`;
  } else {
    return `(${ operands.map((phi) => phi.toString()).join(delimiters) })`;
  }
};

const getSingleSymbol = function (connectiveSymbol: string | string[]): string {
  if (Array.isArray(connectiveSymbol)) {
    if (connectiveSymbol.length === 1) {
      return connectiveSymbol[0];
    } else {
      throw "Wrong number of connective symbols.";
    }
  } else {
    return connectiveSymbol;
  }
}

const complexToString = function (
  template: ConnectiveTemplate<unknown>, 
  operands: Formula<unknown>[]
): string {
  const connSymb = template.connectiveSymbol;
  if (Array.isArray(connSymb) && connSymb.length === 0) {
    throw "Must have at least one connective symbol.";
  }
  if (template.usePrefixNotation) {
    return operandsToString(operands, ` ${ template.connectiveSymbol }`);
  } else {
    const singleSymb = getSingleSymbol(template.connectiveSymbol);
    return `${ singleSymb }(${ operandsToString(operands, ",") })`;
  }
}

class ConnectiveTemplate<T> {
  readonly connectiveSymbol: string | string[];
  readonly operation: (...targets: T[]) => T;
  readonly arity: number;
  readonly usePrefixNotation: boolean;
  readonly memoize: boolean;

  constructor({
    connectiveSymbol, 
    semanticFunc, 
    arity = -1, 
    usePrefixNotation = false,
    memoize = true
  }: {
    connectiveSymbol: string | string[], 
    semanticFunc: (...targets: T[]) => T,
    arity?: number,
    usePrefixNotation?: boolean,
    memoize?: boolean
  }) {
    if (!Number.isInteger(arity)) {
      throw "arity must be an integer.";
    }
    this.connectiveSymbol = connectiveSymbol;
    this.operation = semanticFunc;
    this.arity = arity;
    this.usePrefixNotation = usePrefixNotation;
    this.memoize = memoize;
  }

  makeFormula(...operands: Formula<T>[]): ConnectiveFormula<T> {
    const template = this;
    return Object.freeze(new ConnectiveFormula<T>(template, operands));
  }
}

class ConnectiveFormula<T> extends Formula<T> {
  readonly template: ConnectiveTemplate<T>;
  readonly operands: Formula<T>[];

  constructor(
    template: ConnectiveTemplate<T>,
    operands: Formula<T>[]
  ) {
    const arity = template.arity;
    if (arity >= 0 && arity !== operands.length) {
      throw "Wrong number of operands.";
    }
    const formulaStr = complexToString(template, operands);
    const getDeps = (phi: Formula<T>): Set<number> => phi.dependencies;
    const deps: Set<number> = Set.union(operands.map(getDeps));

    super(formulaStr, deps);
    this.template = template;
    this.operands = operands;
  }

  get connectiveSymbol(): string | string[] {
    return this.template.connectiveSymbol;
  }

  get operation(): (...targets: T[]) => T {
    return this.template.operation;
  }

  matchForm(target: Formula<T>): boolean {
    if (target instanceof Placeholder) {
      return true;
    } else if (!(target instanceof ConnectiveFormula)) {
      return false;
    } else if (target.template !== this.template) {
      return false;
    } else if (target.operands.length !== this.operands.length) {
      return false;
    } else {
      return this.operands.every((phi, i) => phi.matchForm(target.operands[i]));
    }
  }

  evaluate(valuation: T[]): T {
    const operandEvals: T[] = this.operands.map((p: Formula<T>) => p.evaluate(valuation));
    return this.operation(...operandEvals);
  }
}

const makeNary = function ({
  connectiveSymbol, 
  semanticFunc, 
  arity = -1, 
  usePrefixNotation = false,
  memoize = true
}: {
  connectiveSymbol: string | string[], 
  semanticFunc: (...targets: unknown[]) => unknown,
  arity?: number,
  usePrefixNotation?: boolean,
  memoize?: boolean
}) {
  const template = new ConnectiveTemplate({
    connectiveSymbol,
    semanticFunc,
    arity,
    usePrefixNotation,
    memoize
  });
  return template.makeFormula;
}

/*
const connectiveFuncFromMapReduce = function (mapFunc, reduceFunc, outerFunc = identity) {
  // Check mapFunc & reduceFunc are both functions?
  if (!(isFunction(mapFunc) && isFunction(reduceFunc))) {
    const err1 = "The map and reduce functions are both required. ";
    const err2 = "To do nothing for map, pass in a dummy function that simply returns its input.";
    throw concat(err1, err2);
  }
  return (targets) => {
    const actualMap = (inner) => (t) => mapFunc(inner(t));
    return innerEval => outerFunc(targets.map(actualMap(innerEval)).reduce(reduceFunc));
  };
}

function mapReduceFunc(connectiveSymbol, mapFunc, reduceFunc, outerFunc, usePrefixNotation) {
  const semanticFunc = connectiveFuncFromMapReduce(mapFunc, reduceFunc, outerFunc);
  return makeDynamic(connectiveSymbol, semanticFunc, usePrefixNotation);
}
*/

const makeNullary = function ({
  connectiveSymbol, 
  semanticFunc, 
  memoize = true 
}: {
  connectiveSymbol: string,
  semanticFunc: () => unknown,
  memoize?: boolean
}) {
  const template = new ConnectiveTemplate({
    connectiveSymbol,
    semanticFunc,
    arity: 0,
    memoize
  });
  return template.makeFormula;
};

const makeUnary = function ({
  connectiveSymbol, 
  semanticFunc, 
  memoize = true
}: {
  connectiveSymbol: string | string[],
  semanticFunc: (p: unknown) => unknown,
  memoize?: boolean
}) {
  const template = new ConnectiveTemplate({
    connectiveSymbol,
    semanticFunc,
    arity: 1,
    memoize
  });
  return template.makeFormula;
};

const makeBinary = function ({
  connectiveSymbol, 
  semanticFunc, 
  usePrefixNotation = false, 
  memoize = true
}: {
  connectiveSymbol: string | string[],
  semanticFunc: (p: unknown, q: unknown) => unknown,
  usePrefixNotation?: boolean,
  memoize?: boolean
}) {
  const template = new ConnectiveTemplate({
    connectiveSymbol,
    semanticFunc,
    arity: 2,
    usePrefixNotation,
    memoize
  });
  return template.makeFormula;
};

const makeTernary = function ({
  connectiveSymbol, 
  semanticFunc,
  usePrefixNotation = false, 
  memoize = true
}: {
  connectiveSymbol: string | string[],
  semanticFunc: (p: unknown, q: unknown, r: unknown) => unknown,
  usePrefixNotation?: boolean,
  memoize?: boolean
}) {
  const template = new ConnectiveTemplate({
    connectiveSymbol,
    semanticFunc,
    arity: 3,
    usePrefixNotation,
    memoize
  });
  return template.makeFormula;
};

const checkNonNegInt = (n: number): void => {
  if (!Number.isInteger(n) || n < 0) {
    throw "Index must be a non-negative integer.";
  }
}

class Proposition<T> extends Formula<T> {
  readonly propIndex: number;

  constructor(propIndex: number, propSymbol: string = `p${ propIndex }`) {
    super(propSymbol, Set.of(propIndex));
    checkNonNegInt(propIndex);
    this.propIndex = propIndex;
  }

  matchForm(target: Formula<T>): boolean {
    if (target instanceof Placeholder) {
      return true;
    } else if (!(target instanceof Proposition)) {
      return false;
    } else {
      return target.propIndex === this.propIndex;
    }
  }

  evaluate(valuation: T[]): T {
    if (Array.isArray(valuation) && valuation.length > this.propIndex) {
      return valuation[this.propIndex];
    } else {
      throw "Invalid valuation.";
    }
  }
}

class Placeholder<T> extends Formula<T> {
  readonly placeIndex: number;

  constructor(placeIndex: number, placeSymbol: string) {
    super(placeSymbol, Set<number>());
    checkNonNegInt(placeIndex);
    this.placeIndex = placeIndex;
  }

  matchForm(target: Formula<T>): boolean {
    return true;
  }

  evaluate(valuation: T[]): T {
    throw "Cannot evaluate any Formula containing a placeholder.";
  }
}

function translateFunc() {
  // 
}

export {
  Formula,
  Proposition,
  Placeholder,
  ConnectiveTemplate,
  ConnectiveFormula,
  makeNary,
  makeNullary,
  makeUnary,
  makeBinary,
  makeTernary 
};