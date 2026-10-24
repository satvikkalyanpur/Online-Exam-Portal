"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var exams = [
    {
        id: 1,
        title: 'Computer Science Fundamentals',
        subject: 'Computer Science',
        duration: 30,
        questions: [
            {
                id: 1,
                text: 'Which data structure follows FIFO?',
                options: ['Stack', 'Queue', 'Tree', 'Graph'],
                answer: 'Queue',
            },
            {
                id: 2,
                text: 'Which language runs natively in a web browser?',
                options: ['C', 'Java', 'JavaScript', 'SQL'],
                answer: 'JavaScript',
            },
            {
                id: 3,
                text: 'What does HTTP stand for?',
                options: [
                    'Hypertext Transfer Protocol',
                    'High Transfer Text Program',
                    'Hyper Transfer Technology Process',
                    'Host Text Transfer Protocol',
                ],
                answer: 'Hypertext Transfer Protocol',
            },
        ],
    },
    {
        id: 2,
        title: 'Data Structures and Algorithms',
        subject: 'Computer Science',
        duration: 20,
        questions: [
            {
                id: 1,
                text: 'Which data structure uses LIFO?',
                options: ['Queue', 'Stack', 'Array', 'Graph'],
                answer: 'Stack',
            },
            {
                id: 2,
                text: 'What is the average time complexity of binary search?',
                options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
                answer: 'O(log n)',
            },
        ],
    },
];
function App() {
    var _a = (0, react_1.useState)(null), selectedExam = _a[0], setSelectedExam = _a[1];
    var _b = (0, react_1.useState)({}), answers = _b[0], setAnswers = _b[1];
    var _c = (0, react_1.useState)(false), submitted = _c[0], setSubmitted = _c[1];
    function startExam(exam) {
        setSelectedExam(exam);
        setAnswers({});
        setSubmitted(false);
    }
    function submitExam() {
        setSubmitted(true);
    }
    function backToExams() {
        setSelectedExam(null);
        setAnswers({});
        setSubmitted(false);
    }
    var answeredCount = Object.keys(answers).length;
    return (<main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        <p className="intro">
          View your available examinations and complete them online.
        </p>
      </header>

      {!selectedExam ? (<section className="panel">
          <h2>Available Examinations</h2>
          <p>Select an examination to view its questions and begin.</p>

          <div className="exam-list">
            {exams.map(function (exam) { return (<article className="exam-card" key={exam.id}>
                <div>
                  <span className="status">Available</span>
                  <h3>{exam.title}</h3>
                  <p>{exam.subject}</p>
                  <p>
                    {exam.questions.length} questions · {exam.duration} minutes
                  </p>
                </div>

                <button onClick={function () { return startExam(exam); }}>
                  Start examination
                </button>
              </article>); })}
          </div>
        </section>) : (<section className="panel">
          <div className="exam-heading">
            <div>
              <p className="eyebrow">{selectedExam.subject}</p>
              <h2>{selectedExam.title}</h2>
              <p>
                {selectedExam.questions.length} questions ·{' '}
                {selectedExam.duration} minutes allowed
              </p>
            </div>
          </div>

          {submitted ? (<div className="result" role="status">
              <h2>Examination submitted</h2>
              <p>
                You answered {answeredCount} of{' '}
                {selectedExam.questions.length} questions.
              </p>
              <p>Your responses have been submitted in this session.</p>
              <button onClick={backToExams}>Back to examinations</button>
            </div>) : (<>
              <p className="instruction">
                Choose one answer for each question. You can change your
                selections before submitting.
              </p>

              {selectedExam.questions.map(function (question, index) { return (<fieldset className="question" key={question.id}>
                  <legend>
                    {index + 1}. {question.text}
                  </legend>

                  {question.options.map(function (option) { return (<label className="option" key={option}>
                      <input type="radio" name={"question-".concat(question.id)} value={option} checked={answers[question.id] === option} onChange={function () {
                            return setAnswers(function (previous) {
                                var _a;
                                return (__assign(__assign({}, previous), (_a = {}, _a[question.id] = option, _a)));
                            });
                        }}/>
                      {option}
                    </label>); })}
                </fieldset>); })}

              <div className="submission">
                <p>
                  Answered {answeredCount} of{' '}
                  {selectedExam.questions.length} questions
                </p>
                <button onClick={submitExam}>Submit examination</button>
                <button className="secondary" onClick={backToExams}>
                  Cancel
                </button>
              </div>
            </>)}
        </section>)}
    </main>);
}
