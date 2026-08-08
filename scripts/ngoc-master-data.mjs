export const ngocMasterData = {
  branches: [
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000001", branchId: "CS1", name: "Cơ sở 1", address: "82 Lê Trọng Tấn, Tân Phú, TP.HCM", latitude: 10.805888, longitude: 106.6302027 },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000002", branchId: "CS2", name: "Cơ sở 2", address: "1208 Kha Vạn Cân, Thủ Đức, TP.HCM", latitude: 10.8639733, longitude: 106.7613901 },
  ],
  // The source provides a shared first-visit range of 60–90 minutes, not per-service values.
  // Use its conservative upper bound until Ngọc approves service-specific durations.
  services: ["Bi", "Nhũ", "Mông", "Bẹn", "Môi", "Mày"].map((name, index) => ({ id: `e2e29b1a-9b9c-4d2e-b1c5-0000000001${String(index + 1).padStart(2, "0")}`, name, defaultDurationMinutes: 90, refillDurationMinutes: 60 })),
  employees: [
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000201", name: "My", homeBranchId: "CS2", closingLevel: "STRONG", closingLevelSource: "CỨNG", homeArea: "Cầu Phú Mỹ (gần Q.7, Q.1, Q.2, Q.3, Q.9, Nhà Bè)", dispatchNote: "Ưu tiên tour lớn / nhiều dịch vụ khu vực phía Nam & Đông" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000202", name: "Hiền", homeBranchId: "CS2", closingLevel: "STRONG", closingLevelSource: "CỨNG", homeArea: "Linh Xuân, Thủ Đức", dispatchNote: "Ưu tiên tour lớn khu vực Thủ Đức / Dĩ An / TDM" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000203", name: "Quỳnh", homeBranchId: "CS2", closingLevel: "STRONG", closingLevelSource: "CỨNG", homeArea: "Thủ Đức", dispatchNote: "Ưu tiên tour lớn khu vực Thủ Đức / Dĩ An" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000204", name: "Nhung", homeBranchId: "CS1", closingLevel: "STRONG", closingLevelSource: "CỨNG", homeArea: "Hóc Môn", dispatchNote: "Ưu tiên tour lớn khu vực Hóc Môn / Q.12 / Bắc CS1" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000205", name: "Ngọc 2", homeBranchId: "CS2", closingLevel: "NORMAL", closingLevelSource: "Bình Thường", homeArea: "126, Đ.160, KP7, Tăng Nhơn Phú, Thủ Đức", dispatchNote: "Chạy khu vực Thủ Đức / Q.9" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000206", name: "Anh", homeBranchId: "CS1", closingLevel: "NORMAL", closingLevelSource: "Bình Thường", homeArea: "Bình Hưng Hòa, HCM", dispatchNote: "Chạy khu vực Bình Tân / Tân Phú / Gò Vấp" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000207", name: "Hậu", homeBranchId: "CS1", closingLevel: "NORMAL", closingLevelSource: "Bình Thường", homeArea: "Vĩnh Lộc, HCM", dispatchNote: "Chạy khu vực Bình Chánh / Bình Tân / Q.5" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000208", name: "Bình", homeBranchId: "CS1", closingLevel: "WEAK", closingLevelSource: "Bth / Yếu", homeArea: "An Lạc, Bình Tân", dispatchNote: "Chạy khu vực Bình Tân / Q.6 / Q.8" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000209", name: "Yến", homeBranchId: "CS1", closingLevel: "WEAK", closingLevelSource: "Bth / Yếu", homeArea: "Phú Thọ Hòa, HCM", dispatchNote: "Chạy khu vực gần CS1 / Tân Phú" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000210", name: "Thương", homeBranchId: "CS2", closingLevel: "WEAK", closingLevelSource: "Yếu", homeArea: "Tiệm sửa xe A.Sơn (Đông Hòa, Dĩ An/HCM)", dispatchNote: "Ưu tiên chạy đơn dặm / đơn 1 DV Dĩ An, giáp ranh" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000211", name: "Mơ", homeBranchId: "CS2", closingLevel: "WEAK", closingLevelSource: "Yếu", homeArea: "385 Tăng Nhơn Phú, Thủ Đức", dispatchNote: "Ưu tiên đơn dặm / đơn 1 DV gần nhà / Tour xa đi tài xế" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000212", name: "Lan", homeBranchId: "CS1", closingLevel: "WEAK", closingLevelSource: "Yếu", homeArea: "Tân Phú", dispatchNote: "Ưu tiên đơn dặm / đơn 1 DV gần CS1" },
    { id: "e2e29b1a-9b9c-4d2e-b1c5-000000000213", name: "Thiện", homeBranchId: "CS1", closingLevel: "WEAK", closingLevelSource: "Yếu", homeArea: "KS Hòa Bình, Đ. Huỳnh Thị 2, Q.12", dispatchNote: "Ưu tiên đơn dặm / đơn 1 DV Q.12 / Hóc Môn" },
  ],
};
