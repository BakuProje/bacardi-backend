const router = require('express').Router();
const Report = require('../models/Report');

router.post('/', async (req, res) => {
    try {
        const report = new Report({
            growId: req.body.growId,
            category: req.body.category,
            complaint: req.body.complaint,
            responses: [
                {
                    message: req.body.complaint,
                    isAdmin: false,
                    createdAt: new Date()
                }
            ]
        });

        const savedReport = await report.save();

        const autoReply = {
            message: 'Admin Kami akan membalasa Pesan mu Silahkan Menunggu',
            isAdmin: true,
            createdAt: new Date(),
            adminName: 'Bacardi Asisten',
            adminAvatar: './img/bacardiai.png'
        };
        savedReport.responses.push(autoReply);
        await savedReport.save();

        res.status(201).json(savedReport);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.post('/:id/respond', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        report.responses.push({
            message: req.body.message,
            isAdmin: true
        });
        const updatedReport = await report.save();
        res.json(updatedReport);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: 'Report tidak ditemukan' });
        }
        res.json(report);
    } catch (err) {
        res.status(404).json({ message: 'Report tidak ditemukan' });
    }
});


router.put('/:id/close', async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(req.params.id, 
            { status: 'resolved' },
            { new: true }
        );
        res.json(report);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router; 