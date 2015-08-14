var memReq = new XMLHttpRequest();
memReq.open("GET", urlprefix + "z3.emscripten.js.mem", false); // be synchronous
memReq.overrideMimeType('text\/plain; charset=x-user-defined');
memReq.send();
var uint = new Uint8Array(memReq.response.length);
for (var i = 0; i < memReq.response.length; i++) {
    uint[i] = memReq.response.charCodeAt(i);
}
var Module = {
    TOTAL_MEMORY: 128 * 1024 * 1024,
    memoryInitializerRequest: {response: uint.buffer},
    arguments: ["-smt2", "problem.smt2"],
    noInitialRun: true,
    noExitRuntime: true
};
