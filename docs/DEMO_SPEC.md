# Tour Dispatch Demo

## Mục tiêu

Xây dựng bản demo web dành cho một người quản lý để:

1. Xem lịch của 13 nhân viên trong ngày.
2. Nhập một đơn mới hoặc đơn qua liền.
3. Nhận ba đề xuất nhân viên phù hợp.
4. Xem lý do của từng đề xuất.
5. Chọn một nhân viên và cập nhật timeline.
6. Điều chỉnh thời gian hoàn thành khi nhân viên bị trễ.
7. Tính lại đề xuất sau khi lịch thay đổi.

## Phạm vi

- Không cần đăng nhập.
- Không có tài khoản nhân viên.
- Không kết nối Google Maps thật.
- Không kết nối Google Sheet.
- Không kết nối Zalo.
- Không theo dõi GPS.
- Không tự động hoán đổi chuỗi tour.
- Không có thanh toán, doanh thu hoặc chấm công.

## Công nghệ

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- date-fns
- Vitest
- Dữ liệu mẫu lưu trong TypeScript hoặc JSON
- Deploy trên Vercel

## Màn hình chính

### Tổng quan

Hiển thị:

- Số nhân viên đang làm.
- Số nhân viên trống.
- Số nhân viên sắp hoàn thành trong 30 phút.
- Số đơn chưa giao.
- Số cảnh báo trễ.

### Timeline

- Trục dọc: nhân viên.
- Trục ngang: 08:00–20:00.
- Mỗi đơn là một block theo giờ bắt đầu và kết thúc.
- Click block để xem chi tiết.
- Phân biệt đơn đang làm, sắp tới, hoàn thành và cảnh báo trễ.

### Tạo đơn

Các trường:

- Tên khách.
- Khu vực.
- Dịch vụ.
- Giờ yêu cầu.
- Tour mới hoặc đơn dặm.
- Đặt trước hoặc qua liền.
- Ghi chú.

### Đề xuất nhân viên

Hiển thị ba phương án:

- Tên nhân viên.
- Tổng điểm.
- Thời gian dự kiến hoàn thành đơn hiện tại.
- Thời gian di chuyển.
- Thời gian dự kiến đến khách.
- Lý do được chọn.
- Cảnh báo.