var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const logger = require('morgan');
const url = require('url');
const fs = require('fs')
const multer = require('multer');
const crypto = require("crypto");
const moment = require('moment');
var employeeRouter = require('./routes/employee/index');
var divisionRouter = require('./routes/division/index');
var departmentRouter = require('./routes/department/index');
var positionRouter = require('./routes/position/index');
var driverRouter = require('./routes/driver/index');
var authRouter = require('./routes/auth/index');
var officeRouter = require('./routes/office/index');
var locationRouter = require('./routes/location/index');
var vehicleRouter = require('./routes/vehicle/index');
var orderRouter = require('./routes/order/index');
var stationRouter = require('./routes/station/index');
var utilityRouter = require('./routes/utility/index');
var centerRouter = require('./routes/center/index');
var trackingRouter = require('./routes/tracking/index');
var roleRouter = require('./routes/role/index');
var userRouter = require('./routes/user/index');
var bookingRouter = require('./routes/booking/index');
var blackboxRouter = require('./routes/blackbox/index');
var productRouter = require('./routes/product/index');
var app = express();
var cors = require('cors');
var config = require('./configuration/connection');
const prod = config.prod;
const paths = path.join(__dirname, 'files');
const paths_prod = '/root/tms-fuel/back-end/gateway/files/';


// gzip/deflate outgoing responses
var compression = require('compression');
app.use(compression());

// store session state in browser cookie
var cookieSession = require('cookie-session');
app.use(cookieSession({
    keys: ['secret1', 'secret2']
}));

var session = require('express-session');
// parse urlencoded request bodies into req.body
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}))

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(cors());
logger.token('date', function (req, res) {
    return moment().format('YYYY-MM-DD HH:mm:ss');
});

logger.token('body', (req, res) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        let bodyCopy = { ...req.body };

        const sensitiveFields = ['password', 'secret', 'token'];
        sensitiveFields.forEach(field => {
            if (bodyCopy[field]) bodyCopy[field] = '******';
        });

        if (bodyCopy["0"]) {
            bodyCopy = bodyCopy["0"];
        }

        if (Object.keys(bodyCopy).length > 0) {
            // ใช้ JSON.stringify แบบธรรมดาที่สุด 
            // Morgan จะจัดการ string นี้ออกไปที่ console.log เอง
            return JSON.stringify(bodyCopy, null, 2);
        }
    }
    return null;
});


app.use(logger((tokens, req, res) => {
    const mainLog = [
        `[${tokens.date(req, res)}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        `${tokens['response-time'](req, res)} ms`,
        '-',
        tokens.res(req, res, 'content-length')
    ].join(' ');

    const bodyLog = tokens.body(req, res);

    const separator = '\n' + '-'.repeat(50);

    return bodyLog
        ? `${mainLog}\n${bodyLog}${separator}`
        : `${mainLog}${separator}`;
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        debugger
        callback(null, (prod == true) ? paths_prod : paths)
    },
    filename: (req, file, callback) => {
        let id = crypto.randomBytes(16).toString("hex");
        req.id = id;
        // callback(null, id + '.' +
        //     file.originalname.split('.')[file.originalname.split('.').length - 1])
        console.log('filename', req.id)
        callback(null, id + '.jpg')
    }
})

const upload = multer({ storage: storage })
app.post('/api-vrs-v2/upload/temporary', upload.single('fileupload'), async (req, res) => {
    debugger;
    console.log(req.id);
    console.log(req.body);
    if (req.id != undefined) {
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [{ id: req.id }],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.send(response);
    }
});

app.get('/helloword', async (req, res) => {
    let response = {
        status: 'success',
        invalid_code: '0',
        message: 'Hello World',
        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
    }

    res.send(response);
});

app.use(async (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url.toString().indexOf('/helloword') != -1) {
        return;
    } else {
        let xauth = await this.xAuthorization(req, res);
        if (!xauth) {
            return;
        } else {
            next();
        }
    }
});

exports.xAuthorization = async (req, res) => {
    try {

        let lic_code = req.header('lic_code');
        console.log(lic_code);
        if (lic_code == undefined || lic_code.toString() == '') {
            lic_code = 'vrs_dev';
        }

        req.headers['lic_code'] = lic_code; // Ensure it's available for subsequent middleware

        if (lic_code == 'vrs_dev') {
            return true;
        }

        if (lic_code == undefined || lic_code.toString() == '') {
            if (req.url.toString().indexOf('register/license/verification') != -1) {
                return true;
            }
            else if (req.url.toString().indexOf('/source/?image=') != -1 || req.url.toString().indexOf('/favicon.ico') != -1) {
                //debugger
                var query = url.parse(req.url, true).query;
                pic = query.image;
                video = query.video;
                video_stream = query.video_stream;

                if (pic != undefined) {
                    if (typeof pic === 'undefined') {
                        res.writeHead(200, { 'Content-type': 'image/jpg' });
                        res.end(null);
                    } else {
                        //read the image using fs and send the image content back in the response
                        fs.readFile(((prod == true) ? paths_prod : paths) + pic, function (err, content) {
                            if (err) {
                                res.writeHead(200, { 'Content-type': 'image/jpg' });
                                res.end(null);
                            } else {
                                //specify the content type in the response will be an image
                                res.writeHead(200, { 'Content-type': 'image/jpg' });
                                res.end(content);
                            }
                        });
                    }
                }

                if (video != undefined) {
                    if (typeof video === 'undefined') {
                        res.writeHead(200, { 'Content-type': 'video/mp4' });
                        res.end(null);
                    } else {
                        //read the image using fs and send the image content back in the response
                        fs.readFile(((prod == true) ? paths_prod : paths) + video, function (err, content) {
                            if (err) {
                                res.writeHead(200, { 'Content-type': 'video/mp4' });
                                res.end(null);
                            } else {
                                //specify the content type in the response will be an image
                                res.writeHead(200, { 'Content-type': 'video/mp4' });
                                res.end(content);
                            }
                        });
                    }
                }

                if (video_stream != undefined) {
                    const videoPath = ((prod == true) ? paths_prod : paths) + video_stream;
                    const stat = fs.statSync(videoPath);
                    const fileSize = stat.size;
                    const range = req.headers.range;

                    if (range) {
                        const parts = range.replace(/bytes=/, '').split('-');
                        const start = parseInt(parts[0], 10);
                        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                        const chunkSize = (end - start) + 1;
                        const file = fs.createReadStream(videoPath, { start, end });

                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': chunkSize,
                            'Content-Type': 'video/quicktime;video/mp4',
                        });

                        file.pipe(res);
                    } else {
                        res.writeHead(200, {
                            'Content-Length': fileSize,
                            'Content-Type': 'video/quicktime;video/mp4',
                        });

                        fs.createReadStream(videoPath).pipe(res);
                    }
                }
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: "-1",
                    message: "Authorization failed. (lic_code is undefined)",
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(401).send(response);
                return false;
            }
        }
        else {
            if (req.headers.authorization == config.authWebsite() || req.headers.authorization == config.authMobile()) {

                let httpmethod = req.method;
                let url = req.url;
                let body = req.body

                if (httpmethod == undefined) {
                    httpmethod = '';
                }

                if (url == undefined) {
                    url = '';
                }

                if (body == undefined) {
                    body = '{}';
                }

                return true;
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: "-1",
                    message: "Authorization failed.",
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(401).send(response);
                return false;
            }
        }



    }
    catch (ex) {
        let response = [{
            status: 'error',
            invalid_code: "-1",
            message: "Authorization failed.",
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(401).send(response);
        return false;
    }
}

//auth
app.use('/api-vrs-v2/auth', authRouter);
//employee
app.use('/api-vrs-v2/employee', employeeRouter);
//division
app.use('/api-vrs-v2/division', divisionRouter);
//department
app.use('/api-vrs-v2/department', departmentRouter);
//position
app.use('/api-vrs-v2/position', positionRouter);
//driver
app.use('/api-vrs-v2/driver', driverRouter);
//office
app.use('/api-vrs-v2/office', officeRouter);
//location
app.use('/api-vrs-v2/location', locationRouter);
//vehicle
app.use('/api-vrs-v2/vehicle', vehicleRouter);
//order
app.use('/api-vrs-v2/order', orderRouter);
//Utility
app.use('/api-vrs-v2/utility', utilityRouter);
//Center
app.use('/api-vrs-v2/center', centerRouter);
//Tracking
app.use('/api-vrs-v2/tracking', trackingRouter);
//Station
app.use('/api-vrs-v2/station', stationRouter);
//Role
app.use('/api-vrs-v2/role', roleRouter);
//User
app.use('/api-vrs-v2/user', userRouter);
//Booking
app.use('/api-vrs-v2/booking', bookingRouter);
//Blackbox
app.use('/api-vrs-v2/blackbox', blackboxRouter);
//Product
app.use('/api-vrs-v2/product', productRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;