const express = require ('express')
const app = express()
const cp = require ('child_process')
const fs = require ('fs')
const path = require ('path')
const process = require ('process')
const crypto = require ('crypto')
const bodyParser = require('body-parser')
const rimraf = require('rimraf')
const geoip = require('geoip-lite'),
      server_log = function (req, res, next) {
                       ip_detail = geoip.lookup (req.ip)
                       var log = [
                            getTime(),
                            req.ip,
                            ip_detail ? (ip_detail.city + ', ' + ip_detail.country) : 'Unknown location',
                            req.method,
                            "demouser",
                            req.hostname,
                            req.originalUrl,
                            req.get('User-Agent')
                       ].join (' -- ')
                       next()
                   },
      verifytestkey = fs.readFileSync ('hdlwave/private/secretkey').toString().replace (/\n/g, '')

function getTime()
{
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var min = (today.getMinutes() < 10 ? '0' + today.getMinutes() : today.getMinutes())
    var sec = (today.getSeconds() < 10 ? '0' + today.getSeconds() : today.getSeconds())
    var time = today.getHours() + ":" + min + ":" + sec;
    return (date + ' ' + time);
}

// Ensure that tools are installed
function which (command) {
    cmd = command.replace (/[^a-z0-9\-\_]+/g, '')
    return new Promise ((resolve, reject) => {
        try {
            cp.exec ("which " + cmd, (err, stdout, stderr) => {
                if (err) reject (err)
                else resolve (stdout)
            })
        }
        catch (err) {
            reject (err)
        }
    })
}

function rmRecursiveForce (path) {
    rimraf (path, (err) => {
        if (err) console.log ('HDLwave: ' + err)
    })
};

async function toolsExist() {
    try {
        await which ("verilator")
    }
    catch (err) {
        console.error ("Verilator doesn't seem to be installed. Run this script after you've installed Verilator.")
        process.exit()
    }
}
// toolsExist()

function validateVerilog(code) {
    return new Promise ((resolve, reject) => {
        if (!code.includes ('module '))
            reject ({'status': 'failure', 'reason': 'No module(s) found!'})
        else if (code == '')
            reject ({'status': 'failure', 'reason': 'No code received!'})
        else
            resolve ({'status': 'success'})
    })
}

if (process.env.ENABLERATELIMITING && process.env.ENABLERATELIMITING == '1') {
    const redis = require('redis');
    const redisClient = redis.createClient({ enable_offline_queue: false });

    const { RateLimiterRedis } = require('rate-limiter-flexible');
    const opts = {
        // Basic options
        storeClient: redisClient,
        points: 3, // Number of points
        duration: 1, // Per second(s)
        
        // Custom
        execEvenly: false, // Do not delay actions evenly
        blockDuration: 0, // Do not block if consumed more than points
        keyPrefix: 'rlflx', // must be unique for limiters with different purpose
    };
    
    const rateLimiterRedis = new RateLimiterRedis(opts);
    
    function rateLimiterMiddleware (req, res, next) {
        rateLimiterRedis.consume(req.ip)
        .then(() => { next() })
        .catch(() => {
            // Can't consume
            res.status(429).send('Too Many Requests');
        });
    }
}

app.use (server_log)
app.use (bodyParser.json());
app.use (require('sanitize').middleware)
app.use ('/assets', express.static (__dirname + '/assets'))
app.get ('/tests', (req, res) => {
    cp.exec ('ls ' + __dirname + '/tests/', (err, stdout, stderr) => {
        if (err) {
            console.error (err)
            console.error (stderr)
            return
        }
        res.send (stdout.split ("\n")
            .filter (e => e.includes (".sv") && e.includes ("tb_") && !(e == 'tb_template.sv'))
            .map (e => e.replace ('.sv', '').replace ('tb_', ''))
        )
    });
})

// app.post ('/writetest', rateLimiterMiddleware || ((req, res, next) => { next() }), (req, res) => {
//     if (!(req.body.wave && req.body.testname)) {
//         res.json ({'status': 'failure', 'reason': 'No wave data received.'})
//     }
//     else {
//         wave = req.body.wave
//         name = req.body.testname
//         fs.readFile (__dirname + '/tests/tb_template.cpp', null, (err, data) => {
//             if (err) { console.error (err); res.json ({'status': 'failure', 'reason': 'Error opening template.'}); return }
//             data = data.toString()
//             var testbench = []
//             Object.keys (wave.events).forEach (time => {
//                 testbench.push ("\r\n    main_time++;")
//                 Object.keys (wave.events [time]).forEach (signal => {
//                     testbench.push ("    top->" + signal + " = 0b" + wave.events [time][signal] + ";")
//                 })
//                 testbench.push ("\r\n    top->eval();\r\n")
//             })
//             fs.writeFile (__dirname + '/tests/tb_' + name + '.cpp', data.replace ('/*<<TEMPLATEMARK>>*/', testbench.join ('\r\n')), (err) => {
//                 if (err)
//                     res.json ({'status': 'failure', 'reason': 'Unable to save testbench file.'})
//                 else
//                     res.json ({'status': 'success', 'test': name})
//             })
//         })
//     }
// })

app.get ('/wavedraw/', (req, res) => {
    res.sendFile (__dirname + '/wavedraw/embed.html')
})
app.use ('/wavedraw', express.static (__dirname + '/wavedraw'))

// 
// 
// https://stackoverflow.com/questions/8750780/encrypting-data-with-a-public-key-in-node-js
// 
// 
var encryptStringWithRsaPublicKey = function(toEncrypt, relativeOrAbsolutePathToPublicKey, passphrase) {
    var absolutePath = path.resolve(relativeOrAbsolutePathToPublicKey);
    var publicKey = fs.readFileSync(absolutePath, "utf8");
    var buffer = Buffer.from(toEncrypt);
    var encrypted = crypto.publicEncrypt({key: publicKey, passphrase: passphrase, padding: crypto.constants.RSA_PKCS1_PADDING}, buffer);
    return encrypted.toString("base64");
};

// var decryptStringWithRsaPrivateKey = function(toDecrypt, relativeOrAbsolutePathtoPrivateKey, passphrase) {
//     var absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
//     var privateKey = fs.readFileSync(absolutePath, "utf8");
//     var buffer = Buffer.from(toDecrypt, "base64");
//     var decrypted = crypto.privateDecrypt({key: privateKey, passphrase: passphrase, padding: crypto.constants.RSA_PKCS1_PADDING}, buffer);
//     return decrypted.toString("utf8");
// };
// 
// 
// END SNIPPET
// 
// 

app.get (/\/submissions\/?.*/, (req, res) => {
    tas = fs.readFileSync ('ta_list.txt').toString().split ('\n')
    if (tas.includes (req.session.username) && !req.url.match (/\/submissions\/[a-z0-9]+\/[^\.]+\.sv/)) {
        try {
            sanitized = req.query.student.replace (/[^a-z0-9]*/g, '')
        }
        catch (err) {
            sanitized = req.session.username
            if (req.url.match (/^\/submissions\/[a-z0-9]+\/?$/)) {
                res.redirect (301, '/hdlwave/submissions')
                return
            }
        }
        fs.readdir ('hdlwave/submissions/' + sanitized, (err, files) => {
            if (err) {
                res.send ("<h3>User does not exist, you have not submitted anything to HDLwave, or other invalid query.</h3>" + 
                          "<h3>The error was: </h3><code>" + err.toString() + "</code>")
            }
            else {
                links = files.map (e => `<a href="/hdlwave/submissions/${sanitized}/${e}"><p>${e}</p></a>`).join ('\n')
                res.send (
                    `<h2>Index of hdlwave/submissions/${sanitized}</h2>\n` + 
                    links
                )
            }
        })
    }
    else if (tas.includes (req.session.username)) {     // serve systemverilog file
        fs.readFile ('hdlwave' + req.url, 'utf8', (err, data) => {
            if (err) { 
                res.send ("<h3>Invalid file path.</h3>" + 
                          "<h3>The error was: </h3><code>" + err.toString().replace (/\n/g, '<br>') + "</code>")
            }
            else {
                res.send (
                    [`<!DOCTYPE html>`,
                    `<html lang="en">`,
                    `<head>`,
                    `    <link rel="stylesheet" href="/assets/css/hljs.css">`,
                    `    <script src="/assets/js/hljs.js"></script>`,
                    `    <script>hljs.initHighlightingOnLoad();</script>`,
                    `</head>`,
                    `<body>`,
                    `    <pre><code class="verilog">${data}</code></pre>`,
                    `</body>`,
                    `</html>`].join ('\n')
                )
            }
        })
    }
    else {
        res.send ("<h3>Oh... you're not a TA.  We'll be looking into how you found this link.</h3>")
    }
})

app.post('/v2/simulate', rateLimiterMiddleware || ((req, res, next) => { next() }), (req, res) => {
    var testbench = fs.readFileSync(__dirname + '/hdlwave.sv').toString();
    var eventMap = req.body?.eventMap;
    var code = req.body?.code;
    var mode = req.body?.mode || 'waveform';
    var uuid = crypto.createHash ('sha256').update (new Date().toString()).update (crypto.randomBytes(64).toString()).digest ("hex");
    // waveform-based testbenches go here
    if (mode == 'waveform') {
        if (!code || !code.includes('module top') || !eventMap) {
            res.send({status: 'failure', reason: 'Missing data.'});
            return;
        }
        var lines = [];
        var len = Object.keys(eventMap).length;
        // for each 5ms timeframe...
        for (var i = 0; i < len; i++) {
            // construct SystemVerilog lines
            lines.push(`        // ${i}`);
            // get value of signals, combining multiple signals where needed
            var signals = {};
            var line = "        ";
            Object.keys(eventMap[i]).forEach (sig => {
                // if part of a bus signal...
                if (/[a-z0-9]+_[0-9]+_[0-9]+/.test(sig)) {
                    var matched = sig.match(/([a-z0-9]+_([0-9]+))_([0-9]+)/);
                    if (!(matched[1] in signals)) {
                        signals[matched[1]] = " ".repeat(parseInt(matched[2]) + 1);
                    }
                    var val = eventMap[i][sig] == "1" ? `1` : 
                              eventMap[i][sig] == "0" ? `0` :
                              eventMap[i][sig] == "x" ? `x` : "z";
                    var str = signals[matched[1]].split("");
                    str[parseInt(matched[2]) - parseInt(matched[3])] = val;
                    signals[matched[1]] = str.join("");
                }
                // for all other signals, just set the bit in {signals}.
                else {
                    signals[sig] = eventMap[i][sig] == "1" ? "1'b1" : 
                                   eventMap[i][sig] == "0" ? "1'b0" :
                                   eventMap[i][sig] == "x" ? "1'bx" : "1'bz";
                }
            });
            Object.keys(signals).forEach (sig => {
                if (!signals[sig].includes("'b"))
                    signals[sig] = `${signals[sig].length}'b` + signals[sig];
                line += `${sig.match(/^[a-z0-9]+/)[0]} = ${signals[sig]}; `;
            })
            lines.push(line);
            if (i < len - 1)
                lines.push("        #1;");
        }
        // set up signal changes
        testbench = testbench.replace('        /***INSERT HERE***/', lines.join('\n'));
        // set up testbench trace.vcd path
        var path = `/tmp/tmpcode/${uuid}`;
        testbench = testbench.replace('<<path>>', path);
        fs.mkdirSync(path);
        var testbenchpath = `${path}/hdlwave.sv`;
        fs.writeFileSync(testbenchpath, testbench);
        var codepath = `${path}/topmodule.sv`;
        fs.writeFileSync(codepath, code);
    }
    // testbenches written in SystemVerilog handled here
    else {
        if (!code || !code.includes('module top') || !req.body?.testbench || !fs.existsSync(__dirname + `/tests/tb_${req.body?.testbench.match(/^[a-z0-9]+/)[0]}.sv`)) {
            res.send({status: 'failure', reason: `No testbench was specified.`});
            return;
        }
        var testpath = __dirname + `/tests/tb_${req.body?.testbench.match(/^[a-z0-9]+/)[0]}.sv`;
        var path = `/tmp/tmpcode/${uuid}`;
        fs.mkdirSync(path);
        var testbenchpath = `${path}/hdlwave.sv`;
        fs.copyFileSync(testpath, testbenchpath);
        var codepath = `${path}/topmodule.sv`;
        fs.writeFileSync(codepath, code);
    }
    // run icarus compile
    try {
        var output = cp.execSync(`iverilog -g2012 -gspecify ${testbenchpath} ${codepath} -o ${path}/simexe 2>&1`, { cwd: path });
    }
    catch(err) {
        res.send({status: 'failure', reason: `Icarus compile failed: ${err.stdout.toString().replace(new RegExp(path, 'g'), '')}`});
        return;
    }
    // run simulation
    try {
        cp.execSync(`vvp ${path}/simexe 2>&1`, { cwd: path });
    }
    catch(err) {
        res.send({status: 'failure', reason: `Icarus compile failed: ${err.stdout.toString().replace(new RegExp(path, 'g'), '')}`});
        return;
    }
    // check if trace.vcd was produced
    if (!fs.existsSync(`${path}/trace.vcd`)) {
        rmRecursiveForce(path);
        res.send({status: 'failure', reason: 'No VCD data was produced from vvp simulation.'});
    }
    else {
        var data = fs.readFileSync(`${path}/trace.vcd`).toString();
        rmRecursiveForce(path);
        res.send({status: 'success', vcd: data});
    }
});

app.post ('/simulate', rateLimiterMiddleware || ((req, res, next) => { next() }), (req, res) => {
    // get code
    validateVerilog (req.body.code)
    .then (result => {
        if (result.status == 'success') {
            // create random uuid
            uuid = crypto.createHash ('sha256').update (req.body.code).update (new Date ().toString()).digest ("hex");
            fs.mkdirSync ('/tmp/' + uuid)
            fs.writeFileSync ('/tmp/' + uuid + '/code.v', req.body.code)

            // backup code by students
            fs.exists ('hdlwave/submissions/' + req.session.username, exists => {
                if (!exists) {
                    fs.mkdirSync ('hdlwave/submissions/' + req.session.username)
                }
                fs.writeFileSync ('hdlwave/submissions/' + req.session.username + '/' + req.body.test + '_' + getTime().replaceAll(" ", "_") + '.sv', req.body.code)
            })

            // verilate
            try {
                test = req.body.test.match ("[a-z0-9_]+")[0]
                if (test == 'lab12full') {
                    out = cp.execSync ('verilator --build --cc --exe --top-module tb_alu --trace ' + __dirname + '/tb_alu.v code.v ' + __dirname + 
                                       '/tests/tb_lab12full.cpp',
                                       {cwd: '/tmp/' + uuid})
                }
                else {
                    out = cp.execSync ('verilator --build --cc --exe --top-module tb_top --trace ' + __dirname + '/tb_top.v code.v ' + __dirname + 
                                       '/tests/tb_' + test + '.cpp',
                                       {cwd: '/tmp/' + uuid})
                }
            }
            catch (err) {
                rmRecursiveForce ('/tmp/' + uuid)
                res.json ({'status': 'failure', 'reason': {'stderr': 'compile: \n' + (err.toString().split ("\n").slice (1).join ('\n'))}})
                return
            }
            // execute
            try {
                console.log ('HDLwave: ' + "Running simulation...")
                out = cp.execSync ('obj_dir/Vtb_' + (test == 'lab12full' ? 'alu' : 'top'), {cwd: '/tmp/' + uuid}).toString()
                res.hdlwave_test = out.includes ("ALL TESTS PASSED")
                console.log (out.split ("\n")[1])
                if (res.hdlwave_test) {
                    if (out.includes ("PRINT: ")) {
                        // simple payload of username, semester and test name - code is being saved anyway so we can verify
                        var payload = req.session.username + '_sp21' + req.body.test; 
                        // add random nonce, padding it to 30 bytes
                        var nonce = crypto.randomBytes ((30 - (payload.length+1)) / 2).toString ('hex'); 
                        var message = (payload + '_' + nonce).length == 29 ? (payload + '_' + nonce + 'a') : (payload + '_' + nonce); 
                        req.verified_sim_hash = encryptStringWithRsaPublicKey (
                                                    message, 
                                                    'hdlwave/private/hdlwave.pub.pem', ''
                                                ) + '\n' + out.split ("\n")[out.split ("\n").length - 1]; 
                    }
                    else {
                        req.verified_sim_hash = crypto.createHash ('sha256')
                                                .update (req.session.username + 
                                                    req.body.test + 
                                                    verifytestkey
                                                )
                                                .digest ("hex");
                    }
                }
                else {
                    req.verified_sim_hash = out.split ("\n").filter (e => e.startsWith ("ERROR: ")).map (e => e.replace ('ERROR: ', ''))
                    req.verified_sim_hash.unshift ("INVALID")
                    req.verified_sim_hash = req.verified_sim_hash.join ('\n')
                }
            }
            catch (err) {
                rmRecursiveForce ('/tmp/' + uuid)
                console.log ("Error occurred: " + err.toString())
                res.json ({'status': 'failure', 'reason': {'stderr': 'runtime: \n' + (err.toString().split ("\n").slice (1).join ('\n'))}})
                return
            }
            
            if (test == 'lab12full') {
                res.json ({'status': 'success', 'vcd': 'novcdrequired', 'hash': req.verified_sim_hash})
            }
            else {
                // Print top.vcd
                console.log ('HDLwave: ' + "Reading VCD...")
                cp.exec ('cat trace/' + (test == 'lab12full' ? 'alu' : 'top') + '.vcd', {cwd: '/tmp/' + uuid}, (err, stdout, stderr) => {
                    // missing?
                    rmRecursiveForce ('/tmp/' + uuid)
                    if (err) {
                        res.json ({'status': 'failure', 'reason': "No top.vcd file was found."})
                    }
                    // else send contents of vcd
                    else {
                        console.log ('HDLwave: ' + req.session.username + ' got ' + req.verified_sim_hash)
                        res.json ({'status': 'success', 'vcd': stdout, 'hash': req.verified_sim_hash})
                    }
                })
            }

        }
        else {
            res.send (result)
        }
    })
    .catch (result => {
        res.send (result)
    })
})

app.get ('/', (req, res) => {
    res.sendFile (__dirname + "/index.html")
})

if (!module.parent) {
    app.listen (8000, '0.0.0.0')
}

module.exports = app
