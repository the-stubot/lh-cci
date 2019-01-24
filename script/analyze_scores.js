#!/usr/local/bin/node

const fs = require('fs');
const path = require('path');
const bot = require("circle-github-bot").create();


const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const requiredScores = pkg.lighthouse.requiredScores;

const reportsDir = process.argv[3];

const jsonReports = [];
const htmlReportFilenames = [];


fs.readdirSync(reportsDir).forEach(file => {
  if (path.extname(file) === '.json') {
    jsonReports.push(JSON.parse(fs.readFileSync(path.resolve(reportsDir, file), 'utf8')));

  } else if (path.extname(file) === '.html') {
    htmlReportFilenames.push(file);
  }
});

let success = true;

const scoresAcrossRunsByCategory = jsonReports.reduce((acc, run) => {
  Object.keys(requiredScores).forEach(category => {
    acc[category] = acc[category] || [];
    acc[category].push(run.categories[category].score * 100);
  });
  return acc;
}, {});


const ciStdout = [
  '------------------------------------------',
  `Number of parallel test runs: ${jsonReports.length}`,
  '------------------------------------------',
];

const prComment = [
  '<h2>Lighthouse scores</h2>',
  `<p><strong>Number of parallel test runs:</strong>: ${jsonReports.length}</p>`,
  `<p>The best scores across all runs are shown below.</p>`,
];

Object.keys(requiredScores).forEach(category => {
  const requiredOutOf100 = requiredScores[category];
  const actualBestOutOf100 = Math.max.apply(null, scoresAcrossRunsByCategory[category]);


  if (actualBestOutOf100 < requiredScores[category]) {
    ciStdout.push(`❌ ${category}: ${actualBestOutOf100}/${requiredOutOf100}`);
    prComment.push(`<h3>❌ ${category}</h3>`);
    prComment.push(`<p>${actualBestOutOf100}/${requiredOutOf100}</p>`);
    success = false;
  } else {
    ciStdout.push(`✅ ${category}: ${actualBestOutOf100}/${requiredOutOf100}`);
    prComment.push(`<h3>✅ ${category}</h3>`);
    prComment.push(`<p>${actualBestOutOf100}/${requiredOutOf100}</p>`);
  }

  const areAllScoresEqual = scoresAcrossRunsByCategory[category]
    .every((val, i, arr) => val === scoresAcrossRunsByCategory[category][0]);

  if (!areAllScoresEqual) {
    ciStdout.push(`   - scores varied across runs: [${scoresAcrossRunsByCategory[category].join(' ')}]`)
    prComment.push(`<p>Scores varied across runs: [${scoresAcrossRunsByCategory[category].join(' ')}]</p>`)
  }
});

prComment.push('<h3>Detailed reports</h3>');
htmlReportFilenames.forEach((filename, idx) => {
  prComment.push(`<p>bot.artifactLink(`reports/${filename}`, `Run ${idx + 1}`)</p>`);
});

console.log(ciStdout.join('\n'));
console.log(prComment.join('\n'));

bot.comment(process.env.GITHUB_OAUTH_TOKEN, prComment.join('\n'));

if (!success) {
  process.exit(1);
}
