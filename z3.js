export class EmZ3 {
    constructor() {
        this.variables = [];
        this.cvarsByName = {};
        this.varsByName = {};
        this.constraints = [];
        this.domains = [];
        this.domainsByName = {};

        var prefixUrl;
        // A little hackery to find the URL of this very file.
        // Throw an error, then parse the stack trace looking for filenames.
        var errlines = [];
        try {
            throw new Error();
        } catch(e) {
            errlines = e.stack.split("\n");
        }
        console.log(errlines)
        for (var i = 0; i < errlines.length; i++) {
            var match = /((?:https?|file):\/\/.+\/)z3.js/.exec(errlines[i]);
            if (match) {
                prefixUrl = match[1];
                break;
            }
        }
        for (var i = 0; i < errlines.length; i++) {
            var match = /at new EmZ3.*((?:https?|file):\/\/.+\/)/.exec(errlines[1]);
            if (match) {
                prefixUrl = match[1];
                break;
            }
        }
        // if (!prefixUrl) {
        //     throw 'Could not determine em-z3 uri' + errlines;
        // }

        var self = this,
            request = new XMLHttpRequest(),
            // urlprefix = prefixUrl
            urlprefix = "./compiled/";
        request.onreadystatechange = function () {
            var DONE = request.DONE || 4;
            if (request.readyState === DONE){
                var preJs = new XMLHttpRequest();
                preJs.open("GET", urlprefix + "pre.z3.emscripten.js", false); // be synchronous
                preJs.send();
                debugger
                eval(preJs.responseText + ";" + request.responseText);
                self.FS = FS;
            }
        };
        request.open("GET", urlprefix + "z3.emscripten.js", false); // be synchronous
        request.send();
    }

    run(code) {
        var self = this;
        this.stdout = [];
        this.FS.createDataFile("/", "problem.smt2", "(check-sat)" + code, true, true);
        debugger
        try {
            var oldlog = console.log;
            console.log = function () {
                self.stdout.push.apply(self.stdout, arguments);
                oldlog.apply(console, arguments);
            }
            this.Module.callMain(["-smt2", "/problem.smt2"]);
        } finally {
            console.log = oldlog;
            this.FS.unlink("/problem.smt2");
        }
        return this.stdout.join("");
    }

    stdin() {
        debugger
    }
    stdout(c) {
        this.stdout.push(String.fromCharCode(c));
    }
    stderr(c) {
        this.stdout.push(String.fromCharCode(c));
    }

    applyResults(result) {
        result = result.replace(/\(error.*\n/m, "").replace(/^WARNING.*\n/m, "");
        if (result.startsWith("sat")/* || result.indexOf("\nsat\n") != -1 */) {
            var idx = result.indexOf("sat");
            result = result.slice(idx + "sat".length, result.length);
            // remove outer parens
            result = result.trim().slice(2, result.length - 2);

            var assignments = result.split(/\)\s+\(/m).map(function (str) {
                // these are now just pairs of varname value
                var both = str.trim().split(" ");
                if (both.length < 2) return;
                both = [both[0].trim(), both.slice(1, both.length).join(" ").trim()];

                var name = both[0];
                var value = this.parseAndEvalSexpr(both[1], both[0]);
                return {name: name, value: value};
            }.bind(this));
            assignments.each(function (a) {
                this.varsByName[a.name].value = a.value;
            }.bind(this));
        } else if (result.startsWith("unsat")) {
            debugger
            throw "Unsatisfiable constraint system";
        } else {
            throw "Z3 failed to solve this system";
        }
    }

    parseAndEvalSexpr(sexp, varName) {
        if (!sexp) return;
        var variable = this.varsByName[varName];
        if (variable && variable.isString) return sexp;
        var dom = variable && variable._domain;
        if (dom) { // assign a domain value
            if (sexp.charAt(0) !== 'C') {
                throw new Error('Expected a domain value');
            }
            var value = dom[parseInt(sexp.slice(1))];
            return value;
        }

        var fl = parseFloat(sexp);
        if (!isNaN(fl)) return fl;
        var atomEnd = [' ', '"', "'", ')', '(', '\x0b', '\n', '\r', '\x0c', '\t']

        var stack = [],
            atom = [],
            i = 0,
            length = sexp.length;
        while (i < length) {
            var c = sexp[i]
            var reading_tuple = atom.length > 0
            if (!reading_tuple) {
                if (c == '(') {
                    stack.push([]);
                } else if (c == ')') {
                    var pred = stack.length - 2;
                    if (pred >= 0) {
                        stack[pred].push(String(this.evaluateSexpr(stack.pop())));
                    } else {
                        return this.evaluateSexpr(stack.pop());
                    }
                } else if (c.match(/\s/) !== null) {
                    // pass
                } else {
                    atom.push(c);
                }
            } else {
                if (atomEnd.indexOf(c) !== -1) {
                    stack[stack.length - 1].push(atom.join(""));
                    atom = [];
                    i -= 1; // do not skip this
                } else {
                    atom.push(c)
                }
            }
            i += 1;
        }
        throw "NotImplementedError(whatever this is) " + sexp;
    }
    evaluateSexpr(l) {
        var op = l[0],
            self = this,
            args = l.slice(1, l.length).map(function (arg) { return self.evalFloat(arg); });

        switch (op) {
        case "sin":
            return Math.sin(args[0])
        case "cos":
            return Math.cos(args[0])
        case "tan":
            return Math.tan(args[0])
        case "asin":
            return Math.asin(args[0])
        case "acos":
            return Math.acos(args[0])
        case "atan":
            return Math.atan(args[0])
        case "+":
            return args[0] + args[1]
        case "-":
            if (args.length == 1) {
                return -args[0]
            } else {
                return args[0] - args[1]
            }
        case "*":
            return args[0] * args[1]
        case "/":
            return args[0] / args[1]
        case "^":
            return Math.pow(args[0], args[1])
        case "root-obj":
            // ignore imaginary part
            return args[0];
        default:
            throw op + ' in sexprs returned from Z3'
        }
    }
    evalFloat(arg) {
        if (arg.match(/\//)) {
            var nomden = arg.split("/")
            return parseFloat(nomden[0])/parseFloat(nomden[1]);
        } else {
            return parseFloat(arg);
        }
    }

    postMessage(string) {
        string = string.replace(/\n/g, " ") +
            ("(check-sat)(get-value (" + this.variables.reduce(function (acc, v) {
                return acc + v.name + " "
            }, "") + "))");
        this.applyResults(this.run(string).replace("sat", "") /* remove first sat */);
    }

    solveOnce(c) {
        this.addConstraint(c);
        try {
            this.solve();
        } finally {
            this.removeConstraint(c);
        }
    }

    removeVariable(v, cvar) {
        this.variables.remove(v);
        delete this.cvarsByName[v.name];
        delete this.varsByName[v.name];
    }
    addVariable(v, cvar) {
        this.variables.push(v);
        this.cvarsByName[v.name] = cvar;
        this.varsByName[v.name] = v;
    }
    addDomain(array) {
        var dom = this.domains.find(function (ary) {
            return ary.equals(array);
        });
        if (!dom) {
            dom = array.uniq();
            this.domains.push(dom);
        }
        dom.$z3name = "Dom" + this.domains.indexOf(dom)
        this.domainsByName[dom.$z3name] = dom;
        return dom;
    }
    addConstraint(c) {
        this.constraints.push(c);
    }
    removeConstraint(c) {
        this.constraints.remove(c);
    }
    solve() {
        var decls = this.printDeclarations();
        var constraints = this.printConstraints();
        var domains = this.printDomains();
        this.postMessage(domains + decls + constraints);
        return decls + constraints;
    }
    printDeclarations() {
        return [""].concat(this.variables).reduce(function (acc, v) {
            return acc + "\n" + v.printDeclaration();
        });
    }
    printDomains() {
        var i = -1;
        return ["\n"].concat(this.domains).reduce(function (acc, d) {
            return acc + "\n" + ["(declare-datatypes () ((" + d.$z3name].concat(d).reduce(function (accD, el) {
                i++;
                return accD + " C" + i;
            }) + ")))";
        });
    }
    printConstraints() {
        return ["\n"].concat(this.constraints).reduce(function (acc, c) {
            return acc + "\n" + "(assert " + c.print() + ")";
        });
    }
}

class Ast {
    cnEquals (r) {
        return new BinaryExpression("=", this, r, this.solver);
    }
    cnNeq (r) {
        return new UnaryExpression("not", new BinaryExpression("=", this, r, this.solver), this.solver);
    }
    cnGeq (r) {
        return new BinaryExpression(">=", this, r, this.solver);
    }
    cnGreater (r) {
        return new BinaryExpression(">", this, r, this.solver);
    }
    cnLeq (r) {
        return new BinaryExpression("<=", this, r, this.solver);
    }
    cnLess (r) {
        return new BinaryExpression("<", this, r, this.solver);
    }
    divide (r) {
        return new BinaryExpression("/", this, r, this.solver);
    }
    times (r) {
        return new BinaryExpression("*", this, r, this.solver);
    }
    sin() {
        return  this.minus(
            this.pow(3).divide(6)).plus(
                this.pow(5).divide(120)).minus(
                    this.pow(7).divide(5040)).plus(
                        this.pow(9).divide(362880)).minus(
                            this.pow(11).divide(39916800)).plus(
                                this.pow(13).divide(6227020800)).minus(
                                    this.pow(15).divide(1307674400000)).plus(
                                        this.pow(17).divide(355687430000000))
        // Z3 supports sin, but then many systems cannot be solved,
        // so we approximate using Taylor
        // return new UnaryExpression("sin", this, this.solver);
    }
    cos() {
        return this.plus(Math.PI / 2).sin();
        // Z3 supports cos, but then many systems cannot be solved,
        // so we approximate using Taylor. We go through Taylor-sin, to
        // avoid issues with imaginary components, because Taylor-cos uses even powers
        // return new UnaryExpression("cos", this, this.solver);
    }
    minus (r) {
        return new BinaryExpression("-", this, r, this.solver);
    }
    print() {
        throw "my subclass should have overridden `print'"
    }
    plus (r) {
        return new BinaryExpression("+", this, r, this.solver);
    }
    pow (r) {
        return new BinaryExpression("^", this, r, this.solver);
    }
    cnAnd (r) {
        return new BinaryExpression("and", this, r, this.solver);
    }
    cnOr (r) {
        return new BinaryExpression("or", this, r, this.solver);
    }
    isConstraintObject() {
        return true;
    }
}

export class Variable extends Ast {
    constructor(name, value, solver) {
        super();
        this.name = name;
        this.value = value;
        this.solver = solver;
    }
    stay(strength) {
        throw "stay constraints not implemented for Z3 (yet)"
    }
    removeStay() {
        // throw "stay constraints not implemented for Z3 (yet)"
        // pass
    }
    suggestValue(value) {
        if (value === this.value) return;

        var c = this.cnEquals(value);
        this.solver.solveOnce(c);
    }
    setReadonly(bool) {
        if (bool && !this.readonlyConstraint) {
            var cn = this.cnEquals(this.value);
            this.solver.addConstraint(cn);
            this.readonlyConstraint = cn;
            return cn;
        } else if (!bool && this.readonlyConstraint) {
            this.solver.removeConstraint(this.readonlyConstraint);
            this.readonlyConstraint = undefined;
        }
    }
    isReadonly() {
        return !!this.readonlyConstraint;
    }
    cnIn(domain) {
        this.setDomain(domain);
        return new EmptyExpression(this, this.solver)
    }
    setDomain(domain) {
        if (this._domain) {
            // TODO: figure out what to really do
            this._domain = this._domain.intersect(domain);
            if (this._domain.length === 0) {
                throw new Error('Domain intersection is empty');
            }
        }
        this._domain = domain;
        this._domain = this.solver.addDomain(this._domain);
    }

    cnIdentical(value) {
        if (this._domain && !value.isConstraintObject) {
            debugger
            return this.cnEquals('C' + this._domain.indexOf(value));
        } else {
            return this.cnEquals(value); // the same for numbers
        }
    }
    cnNotIdentical(value) {
        return new UnaryExpression("not", this.cnIdentical(value), this.solver);
    }

    print() {
        return this.name;
    }
    printDeclaration() {
        if (this.isString) {
            return "(declare-variable " + this.name + " String)"
        } else if (this._domain) {
            return "(declare-fun " + this.name + " () " + this._domain.$z3name + ")"
        } else {
            return "(declare-fun " + this.name + " () Real)"
        }
    }

    prepareEdit() {
        throw "Z3 does not support editing"
    }
    finishEdit() {
        throw "Z3 does not support editing"
    }
}

export class Constant extends Ast {
    constructor(value, solver) {
        super();
        this.value = value;
        this.solver = solver;
    }
    print () {
        return "" + this.value;
    }
}

export class Constraint extends Ast {
    enable(strength) {
        if (strength && strength !== "required") {
            throw "Z3 does not support soft constraints (yet)"
        }
        this.solver.addConstraint(this);
    }
    disable() {
        this.solver.removeConstraint(this);
    }
}

export class BinaryExpression extends Constraint {
    constructor(op, left, right, solver) {
        super();
        this.solver = solver;
        this.op = op;
        this.left = this.z3object(left);
        this.right = this.z3object(right);
    }
    z3object(obj) {
        if (obj instanceof Ast) {
            return obj;
        } else {
            // return new Constant(parseFloat(obj), this.solver);
            return new Constant(obj, this.solver);
        }
    }
    print () {
        return "(" + this.op + " " + this.left.print() + " " + this.right.print() + ")"
    }
}

export class TertiaryExpression extends BinaryExpression {
    constructor(op, first, second, third, solver) {
        super(op, first, second, solver);
        this.first = this.z3object(first);
        this.second = this.z3object(second);
        this.third = this.z3object(third);
    }

    print () {
        return "(" + this.op + " " + this.first.print() + " "
            + this.second.print() + " " + this.third.print() + ")"
    }
}

export class UnaryExpression extends Constraint {
    constructor(op, arg,  solver) {
        super();
        this.solver = solver;
        this.op = op;
        this.arg = arg;
    }
    print () {
        return "(" + this.op + " " + this.arg.print() + ")"
    }
}

export class EmptyExpression extends Constraint {
    initialize (variable,  solver) {
        this.solver = solver;
        this.variable
    }
    print () {
        return "(= 1 1)";
    }
}
