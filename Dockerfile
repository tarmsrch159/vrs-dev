# ใช้ Node.js LTS version
FROM node:18-alpine

# สร้าง directory สำหรับแอป
WORKDIR /usr/src/app

# คัดลอก package.json และ package-lock.json (ถ้ามี)
COPY package*.json ./

# ติดตั้ง dependencies
# ใช้ npm install --production เพื่อลดขนาด image (ไม่ลง devDependencies)
RUN npm install

# คัดลอก code ทั้งหมดเข้า container
COPY . .

# เปิด port ตามที่แอปใช้งาน (ปกติ Express คือ 3000)
EXPOSE 9100

# คำสั่งสำหรับรันแอป
CMD [ "npm", "start" ]