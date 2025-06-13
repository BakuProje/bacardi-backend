const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const Report = require('./models/Report');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "https://bpsreport.vercel.app",
        methods: ["GET", "POST", "PUT"]
    }
});


app.use(cors({
  origin: 'https://bpsreport.vercel.app' // ganti dengan URL frontend kamu di Vercel
}));
app.use(express.json());


app.get('/test', (req, res) => {
    res.json({ message: 'Backend berjalan!' });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    let currentRoom = null;

    socket.on('join-report', async (reportId) => {

        if (currentRoom) {
            socket.leave(currentRoom);
        }
        
        currentRoom = reportId;
        socket.join(reportId);
        console.log(`User ${socket.id} joined report ${reportId}`);
        
        try {
            const report = await Report.findById(reportId);
            if (report) {

                socket.emit('chat-history', report.responses);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.reportId).emit('typing', data);
    });

    socket.on('stop-typing', (data) => {
        socket.to(data.reportId).emit('stop-typing', data);
    });

    socket.on('send-message', async (data) => {
        try {
            const { reportId, message, isAdmin, image } = data;
            const report = await Report.findById(reportId);
            
            if (report) {
                const newMessage = {
                    message,
                    isAdmin,
                    image,
                    createdAt: new Date(),
                    read: false
                };
                
                report.responses.push(newMessage);
                await report.save();

                io.to(reportId).emit('new-message', {
                    ...newMessage,
                    reportId
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message-error', { error: 'Gagal mengirim pesan' });
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            socket.leave(currentRoom);
        }
        console.log('User disconnected:', socket.id);
    });
});


app.post('/api/reports', async (req, res) => {
    try {
        const report = new Report({
            growId: req.body.growId,
            category: req.body.category,
            complaint: req.body.complaint,
            status: 'pending',
            responses: [{
                message: req.body.complaint,
                isAdmin: false,
                createdAt: new Date(),
                read: false
            }]
        });

        const savedReport = await report.save();

        const autoReply = {
            message: 'Admin Kami akan membalasa Pesan mu Silahkan Menunggu',
            isAdmin: true,
            adminName: 'Bacardi Asisten',
            adminAvatar: './img/bacardiai.png',
            createdAt: new Date(),
            read: false
        };
        savedReport.responses.push(autoReply);
        await savedReport.save();

        io.emit('new-report', savedReport);
        io.to(savedReport._id.toString()).emit('new-message', {
            ...autoReply,
            reportId: savedReport._id
        });

        res.status(201).json(savedReport);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/reports/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: 'Report tidak ditemukan' });
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Fungsi untuk menghapus file gambar di responses
async function deleteReportImages(report) {
    if (!report || !Array.isArray(report.responses)) return;
    const fs = require('fs');
    const path = require('path');
    for (const resp of report.responses) {
        if (resp.image && typeof resp.image === 'string') {
            // image path: '/uploads/xxxx.jpg' => uploads/xxxx.jpg
            const filePath = resp.image.startsWith('/') ? resp.image.substring(1) : resp.image;
            const absPath = path.join(__dirname, filePath);
            if (fs.existsSync(absPath)) {
                try { fs.unlinkSync(absPath); } catch (e) { /* ignore */ }
            }
        }
    }
}

app.put('/api/reports/:id/close', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: 'Report tidak ditemukan' });
        }
        await deleteReportImages(report);
        await Report.findByIdAndDelete(req.params.id);
        io.emit('report-closed', { reportId: req.params.id });
        res.json({ message: 'Report closed and deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


app.delete('/api/reports/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        await deleteReportImages(report);
        await Report.findByIdAndDelete(req.params.id);
        io.emit('chat-deleted', { reportId: req.params.id });
        res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ message: 'Failed to delete report' });
    }
});


const reportSchema = new mongoose.Schema({
    growId: String,
    category: String,
    complaint: String,
    status: {
        type: String,
        default: 'pending'
    },
    responses: [{
        message: String,
        isAdmin: Boolean,
        image: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        read: {
            type: Boolean,
            default: false
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});


mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Terhubung ke MongoDB!'))
    .catch(err => console.error('MongoDB connection error:', err));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});

// Pastikan folder uploads ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // batas ukuran file 5MB
    },
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (JPEG, PNG, GIF) yang diperbolehkan!'));
        }
    }
});

// Route upload
app.post('//api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'Tidak ada file yang diupload' 
            });
        }
        
        const filePath = '/uploads/' + req.file.filename;
        res.json({ 
            success: true,
            path: filePath,
            message: 'File berhasil diupload'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Gagal mengupload file' 
        });
    }
});

// Error handling untuk multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false,
                message: 'File terlalu besar. Maksimal 5MB' 
            });
        }
        return res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
    if (error) {
        return res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
    next();
});

// Serve static files dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files
app.use('/uploads', express.static('uploads')); 