# Business Rules

## Phân loại nhân viên

- Cứng
- Bình thường
- Bình thường/Yếu
- Yếu

## Luật loại ứng viên

R1. Loại nhân viên nghỉ trong ngày.

R2. Loại nhân viên không thể hoàn thành đơn trước và di chuyển
đến khách mới đúng giờ.

R3. Loại nhân viên nếu lịch mới chồng lên một đơn đã được xác nhận.

R4. Loại nhân viên nếu khoảng cách vượt quá:
- 30 km đối với tour mới.
- 20 km đối với đơn dặm.

## Luật chấm điểm

Điểm ban đầu: 100.

- Trừ 3 điểm cho mỗi kilomet di chuyển.
- Trừ 20 điểm nếu khác vùng cơ sở ưu tiên.
- Cộng 25 điểm nếu tour từ hai dịch vụ và nhân viên Cứng.
- Cộng 15 điểm nếu tour một dịch vụ hoặc đơn dặm và nhân viên
  thuộc mức Bình thường/Yếu hoặc Yếu.
- Cộng 10 điểm nếu nhân viên hoàn thành đơn hiện tại trong vòng
  30 phút.
- Trừ 8 điểm cho mỗi tour nhiều hơn mức trung bình trong ngày.
- Trừ điểm nếu thời gian đệm trước giờ khách quá ngắn.

## Kết quả

- Luôn trả tối đa ba phương án.
- Đánh dấu một phương án tốt nhất.
- Không tự động giao đơn.
- Mỗi phương án phải có reasons và warnings.
- Khi không có ứng viên phù hợp, trả cảnh báo rõ ràng.