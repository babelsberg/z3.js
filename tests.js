import * as z3 from './z3.js';

function equals(a1, a2) {
    if (!Array.isArray(a1) || !Array.isArray(a2)) {
        throw new Error("Arguments to function equals(a1, a2) must be arrays.");
    }

    if (a1.length !== a2.length) {
        return false;
    }

    for (var i=0; i<a1.length; i++) {
        if (Array.isArray(a1[i]) && Array.isArray(a2[i])) {
            if (equals(a1[i], a2[i])) {
                continue;
            } else {
                return false;
            }
        } else {
            if (a1[i] !== a2[i]) {
                return false;
            }
        }
    }

    return true;
}

var self = {};

describe('z3', function() {
    beforeEach(function() {
        self = {
            assert: function(cond, msg) {
                if (!cond) {
                    throw new Error(msg || "Assertion error");
                }
            }
        };
    });

    it("Disjunction", function () {
        var solver = new z3.EmZ3(true),
            v = new z3.Variable('v1', 0, solver),
            c = v.cnGeq(12);
        self.assert(v.value == 0);
        c.enable();
        solver.solve();
        self.assert(v.value == 12);
    });
});
