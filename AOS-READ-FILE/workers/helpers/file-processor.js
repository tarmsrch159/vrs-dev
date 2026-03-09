const fs = require('fs');

// ============================================================
// ฟังก์ชันประมวลผลไฟล์ในโฟลเดอร์ (ใช้แยกเพื่อรองรับ recursive subfolder)
// ============================================================
async function processFilesInFolder(client, sourceFolder, targetArchiveFolder, parserFn) {
    const fileList = await client.list(sourceFolder);
    const files = fileList.filter(f =>
        f.type === '-' && // '-' หมายถึงเป็นไฟล์ (ถ้า 'd' คือโฟลเดอร์)
        f.name.toLowerCase().endsWith('.csv')
    );

    // เรียงลำดับจากเก่าไปใหม่ได้ง่ายขึ้นเลย เพราะมันให้ timestamp มาแล้ว
    files.sort((a, b) => a.modifyTime - b.modifyTime);


    console.log(`>> เจอไฟล์ทั้งหมด: ${files.length} ไฟล์`);
    if (files.length === 0) {
        console.log(`>> ไม่มีไฟล์ใหม่ในโฟลเดอร์นี้`);
        return;
    }

    console.log(`>> รายชื่อไฟล์:`, files.map(f => f.name));

    for (const file of files) {
        console.log(`กำลังประมวลผลไฟล์: ${file.name} (ขนาด: ${file.size} bytes)`);

        const localFilePath = `./temp_${file.name}`;
        const sourceFilePath = `${sourceFolder}/${file.name}`;
        const targetFilePath = `${targetArchiveFolder}/${file.name}`;// ย้ายไฟล์ไปที่โฟลเดอร์ Backup

        // A. ดาวน์โหลดไฟล์มาไว้ที่เครื่อง Node ก่อน
        console.log(`-> กำลังดาวน์โหลดไฟล์มาที่ ${localFilePath}...`);
        await client.fastGet(sourceFilePath, localFilePath);
        console.log(`-> ดาวน์โหลดเสร็จสิ้น`);

        // B. อ่านไฟล์และ Insert ลง DB
        const fileContent = fs.readFileSync(localFilePath, 'utf8');
        console.log(`-> อ่านข้อมูลสำเร็จ (ยาว ${fileContent.length} ตัวอักษร)`);

        try {
            //เรียก function สำหรับ insert ลง DB
            await parserFn(fileContent, file.name);
        } catch (dbErr) {
            console.error(`   ❌ Insert DB ล้มเหลว (${file.name}): ${dbErr.message}`);
        }

        // C. ทำการ "Duplicate" โดยการอัปโหลดไฟล์จากเครื่องเรา ไปที่ Backup Folder
        // console.log(`-> กำลัง Copy (Upload) ไฟล์ไปที่ Backup Folder...`);
        // try {
        //     // **จุดที่ต้องแก้**: ขึ้นอยู่กับ Library FTP ที่คุณใช้
        //     // 1. ถ้าใช้ไลบรารี 'basic-ftp' จะใช้คำสั่ง:
        //     await client.uploadFrom(localFilePath, targetFilePath);

        //     // 2. ถ้าใช้ไลบรารี 'ssh2-sftp-client' (SFTP) จะใช้คำสั่ง:
        //     // await client.put(localFilePath, targetFilePath);

        //     console.log(`-> Copy ไฟล์สำเร็จ: ${targetFilePath}`);
        // } catch (copyErr) {
        //     console.error(`-> Copy ไฟล์ไม่สำเร็จ: ${copyErr.message}`);
        // }


        // สังเกตว่าเราตัดคำสั่ง client.rename และ client.remove ทิ้งไปเลย
        // ทำให้ไฟล์ต้นฉบับจะยังคงอยู่ใน sourceFolder เหมือนเดิมครับ

        console.log(`--------------------------------------------`);

        // C. ลบไฟล์ชั่วคราวในเครื่อง Node ทิ้ง
        fs.unlinkSync(localFilePath);
        console.log(`-> ลบไฟล์ temp ในเครื่องทิ้งเรียบร้อย`);



        console.log(`-> กำลังย้ายไฟล์บน FTP ไปที่ Backup Folder...`);
        try {
            await client.rename(sourceFilePath, targetFilePath);
            console.log(`-> ย้ายไฟล์สำเร็จ: ${targetFilePath}`);


        } catch (renameErr) {
            console.error(`-> ย้ายไฟล์ไม่สำเร็จ: ${renameErr.message}`);
        }
        console.log(`--------------------------------------------`);
    }
}

module.exports = { processFilesInFolder };
