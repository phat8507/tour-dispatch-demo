# Acceptance Criteria

## Dashboard

- Hiển thị đủ 13 nhân viên.
- Timeline chạy từ 08:00 đến 20:00.
- Có tối thiểu 18 đơn mẫu.
- Có cả CS1 và CS2.
- Có ít nhất một nhân viên nghỉ.
- Có ít nhất một đơn có nguy cơ trễ.

## Tạo đơn

- Người dùng nhập được đơn mới.
- Validate các trường bắt buộc.
- Không làm mất dữ liệu khi đóng modal ngoài ý muốn.

## Assignment Engine

- Trả tối đa ba nhân viên.
- Không trả nhân viên nghỉ.
- Không trả nhân viên chắc chắn bị chồng lịch.
- Xét được nhân viên đang làm nhưng sắp hoàn thành.
- Có estimatedArrival.
- Có score.
- Có reasons.
- Có warnings.

## Xác nhận

- Chọn nhân viên sẽ thêm đơn vào timeline.
- Tổng quan được cập nhật.
- Không cho phép xác nhận nếu lịch bị xung đột.

## Điều chỉnh

- Có nút cộng thêm 15, 30 hoặc 60 phút.
- Timeline cập nhật sau khi điều chỉnh.
- Các đơn bị ảnh hưởng xuất hiện cảnh báo.

## Demo

- Có nút Reset demo.
- Chạy được ở màn hình laptop.
- Không có lỗi console nghiêm trọng.
- Tất cả unit test phải pass.