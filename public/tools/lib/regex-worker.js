// Tech debt fix (ReDoS protection): runs the actual regex match loop off the main thread.
// A catastrophic-backtracking pattern (e.g. /(a+)+$/ against a long non-matching string)
// can make RegExp#exec() run for an effectively unbounded amount of time. There is no way
// to "cancel" a synchronous exec() call from the outside -- the only real mitigation is to
// run it somewhere that can be forcibly terminated, which is exactly what a Web Worker
// gives us: if this worker doesn't respond within the timeout set by the page
// (tools/regex-tester.html), the page calls worker.terminate(), which kills this whole
// thread instantly, mid-computation, with no cooperation required from the code running
// here. That's the other half of this fix -- see runRegexInWorker() in regex-tester.html.
//
// The actual match/highlight logic lives in regex-run.js (shared with the inline fallback
// and covered by tests/regex-run.test.js) so it isn't duplicated here.
importScripts('html-escape.js', 'regex-run.js');

var escapeHtml = HtmlEscapeLib.escapeHtml;
var runMatch = RegexRunLib.runMatch;

self.onmessage = function (e) {
  var requestId = e.data.requestId;
  var result = runMatch(e.data.pattern, e.data.flags, e.data.text, escapeHtml);
  result.requestId = requestId;
  self.postMessage(result);
};
