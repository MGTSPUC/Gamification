# แผนเชื่อม Apps Script (ยังไม่เปิดใช้งาน)

## ข้อมูลจากชีต

คีย์การลงทะเบียน: `studentId + courseCode + groupCode` ห้ามจับคู่ด้วยชื่อหรืออาศัยลำดับแถว

| ข้อมูล | ต้นทางแท็บ รวม | ปลายทางแท็บ แสดงผล | เต็ม |
|---|---|---|---:|
| รหัสนักศึกษา | D | A | — |
| วิชา | B | G | — |
| กลุ่มเรียน | C | H | — |
| เข้าเรียน | V | I | 5 |
| กิจกรรม | AJ | J | 15 |
| Final Project | AL | K | 20 |
| กลางภาค | AM | L | 30 |
| ปลายภาค | AN | M | 30 |
| คะแนนรวมก่อนตัดเกรด | AO | N | 100 |
| คะแนนพิเศษ | AP | O | แยกจากฐาน 100 |
| คะแนนรวมสุทธิ | AQ | P | ตามสูตรอาจารย์ |
| ระดับ | AR | Q | — |
| อันดับภายในห้อง | AS | R | — |

สูตรต้นทางที่ตรวจแล้ว: V = SUM(I:U)/13*5, AJ = SUM(W:AI)/65*15, AL = AK/50*20
กลางภาคและปลายภาคใช้คะแนนเต็ม 30 ตามเกณฑ์รายวิชาที่อาจารย์ระบุ

## สถานะการประเมิน

ต้องมีการตั้งค่าสถานะแยกจากคะแนนตามรายวิชา/กลุ่มเรียน:
- `in_progress`: เข้าเรียน/กิจกรรม
- `published`: กลางภาค
- `pending_presentation`: Final Project
- `not_started`: ปลายภาค

สูตร Project อาจคืนค่า 0 แม้ยังไม่มีคะแนนดิบ จึงห้ามอนุมานว่า 0 = สอบตกหรือยังไม่ประเมิน ต้องอ่านสถานะก่อนแปลงค่าที่แสดงเป็น null
เมื่อประกาศคะแนนจริง 0 ต้องแสดง 0 อย่างถูกต้อง ไม่เปลี่ยนเป็นค่าว่าง

## ระบบหลังบ้าน

1. ตรวจบัญชีบน Apps Script เท่านั้น ไม่ดาวน์โหลดคอลัมน์รหัสผ่านมาให้ browser
2. ก่อนใช้จริงย้ายจากรหัสผ่านข้อความธรรมดาไปเป็น password verifier ที่เหมาะสม หรือใช้ identity provider; ไม่ฝัง shared secret ใน GitHub Pages
3. session มีวันหมดอายุ, logout, จำกัดความถี่การเข้าสู่ระบบ และไม่บันทึกรหัสผ่านลง URL/log
4. ทุกคำขอต้องตรวจว่า session เข้าถึง studentId และ enrollment นั้นได้จริง
5. ส่งให้ผู้ใช้เฉพาะคะแนนตนเอง; Leaderboard ส่งนามแฝง/อวาตาร์/อันดับและข้อมูลที่อาจารย์อนุมัติ ไม่ส่งรายชื่อจริงและรหัสนักศึกษาทั้งห้อง
6. Avatar save ตรวจชนิด/ช่วงค่า และบันทึกเป็น settings ของ studentId ฝั่ง server
7. ทดสอบ CORS/redirect ของ Apps Script กับ origin ของ GitHub Pages ก่อนเลือก transport; ห้ามใช้ JSONP กับข้อมูลส่วนบุคคลหรือรหัสผ่าน
8. ถ้า direct cross-origin API ไม่รองรับ flow ที่ต้องการ ให้ใช้ Apps Script HTML Service หรือ same-origin server proxy ที่ตรวจสิทธิ์ ไม่ใช้ no-cors แล้วถือว่า login สำเร็จ

## API contract ที่เสนอ

- login → session + profile (ไม่มี password ใน response)
- enrollments → วิชาและกลุ่มที่ผู้ใช้มีสิทธิ์
- scores(enrollment) → 5 components: earned nullable, max, status; total; rank
- leaderboard(enrollment) → นามแฝง/อันดับที่อนุญาต พร้อม currentUser marker
- saveAvatar → validated settings
- logout → invalidate session

โค้ดรอบนี้เป็น UI prototype เท่านั้น ยังไม่ได้สร้างหรือ deploy API เหล่านี้

อ้างอิง: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [Content Service](https://developers.google.com/apps-script/guides/content)
