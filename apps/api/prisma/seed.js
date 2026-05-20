const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Seed v2 — Niche-only.
 *
 * Sản phẩm hoàn toàn đến từ crawler Accesstrade (sprint at-source-of-truth).
 * Seed này chỉ tạo:
 *   1. 12 Niche làm presentation layer — admin onboard campaign vào Niche.
 *   2. PromptTemplate hệ thống (default-parser cho extraction, article-buying-guide & article-review cho blog AI).
 *   3. Dọn legacy product IDs từ seed v1 (hardcoded a1000001-* / b2000001-*).
 *
 * KHÔNG seed Product / ClickLog / ConversionWebhook. Data đó phát sinh tự nhiên từ crawler + user click.
 */

/**
 * 100 niche phủ rộng affiliate market VN. Mỗi niche có schemaConfig dynamic định
 * nghĩa field cần extract khi Refinery/Crawler đẩy data vào. Admin onboard campaign
 * Accesstrade vào niche → crawler tự tag sản phẩm theo.
 *
 * Nhóm theo domain:
 *   - Điện thoại & máy tính bảng (15)
 *   - Computing (10)
 *   - Audio (6)
 *   - Wearables (5)
 *   - Camera & photo (6)
 *   - Smart home (10)
 *   - Đồ gia dụng nhỏ (12)
 *   - Đồ điện lớn (5)
 *   - Mỹ phẩm & làm đẹp (10)
 *   - Sức khoẻ & thể thao (6)
 *   - Mẹ & bé (5)
 *   - Pet (3)
 *   - Other (7)
 */
const NICHES = [
  // ─── ĐIỆN THOẠI & MÁY TÍNH BẢNG (15) ───
  { slug: "dien-thoai-xiaomi", name: "Điện thoại Xiaomi", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", screenInches: "number", refreshRateHz: "number", mainCameraMp: "number", os: "string" } },
  { slug: "dien-thoai-samsung", name: "Điện thoại Samsung", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", screenInches: "number", refreshRateHz: "number", mainCameraMp: "number", os: "string" } },
  { slug: "iphone", name: "iPhone", schemaConfig: { chip: "string", ramGb: "number", storageGb: "number", batteryHours: "number", screenInches: "number", refreshRateHz: "number", mainCameraMp: "number", connector: "string" } },
  { slug: "dien-thoai-oppo", name: "Điện thoại OPPO", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", screenInches: "number", mainCameraMp: "number" } },
  { slug: "dien-thoai-vivo", name: "Điện thoại Vivo", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", screenInches: "number", mainCameraMp: "number" } },
  { slug: "dien-thoai-realme", name: "Điện thoại Realme", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", screenInches: "number", mainCameraMp: "number" } },
  { slug: "dien-thoai-tam-trung", name: "Điện thoại tầm trung 5-10 triệu", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", chargingW: "number", priceVnd: "number" } },
  { slug: "dien-thoai-cao-cap", name: "Điện thoại cao cấp / flagship", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", batteryMah: "number", mainCameraMp: "number", priceVnd: "number" } },
  { slug: "dien-thoai-gaming", name: "Điện thoại gaming", schemaConfig: { chipset: "string", ramGb: "number", coolingType: "string", refreshRateHz: "number", batteryMah: "number" } },
  { slug: "dien-thoai-pin-trau", name: "Điện thoại pin trâu 6000mAh+", schemaConfig: { batteryMah: "number", chargingW: "number", chipset: "string", screenInches: "number" } },
  { slug: "ipad", name: "iPad / máy tính bảng Apple", schemaConfig: { chip: "string", storageGb: "number", screenInches: "number", connector: "string", pencilSupport: "boolean" } },
  { slug: "may-tinh-bang-android", name: "Máy tính bảng Android", schemaConfig: { chipset: "string", ramGb: "number", storageGb: "number", screenInches: "number", batteryMah: "number" } },
  { slug: "may-doc-sach", name: "Máy đọc sách Kindle / Kobo", schemaConfig: { screenInches: "number", storageGb: "number", warmLight: "boolean", waterproof: "boolean", refreshRateHz: "number" } },
  { slug: "phu-kien-dien-thoai", name: "Phụ kiện điện thoại (case/cường lực/sạc)", schemaConfig: { type: "string", compatibility: "string", material: "string" } },
  { slug: "sac-du-phong", name: "Sạc dự phòng", schemaConfig: { capacityMah: "number", outputW: "number", portCount: "number", weightGram: "number" } },

  // ─── COMPUTING (10) ───
  { slug: "laptop", name: "Laptop", schemaConfig: { cpu: "string", ramGb: "number", storageGb: "number", screenInches: "number", gpu: "string", batteryHours: "number", weightKg: "number" } },
  { slug: "laptop-gaming", name: "Laptop gaming", schemaConfig: { cpu: "string", gpu: "string", ramGb: "number", storageGb: "number", screenInches: "number", refreshRateHz: "number" } },
  { slug: "laptop-van-phong", name: "Laptop văn phòng", schemaConfig: { cpu: "string", ramGb: "number", storageGb: "number", screenInches: "number", batteryHours: "number", weightKg: "number" } },
  { slug: "laptop-do-hoa", name: "Laptop đồ hoạ / kiến trúc", schemaConfig: { cpu: "string", gpu: "string", ramGb: "number", storageGb: "number", colorGamut: "string" } },
  { slug: "macbook", name: "MacBook", schemaConfig: { chip: "string", ramGb: "number", storageGb: "number", screenInches: "number", batteryHours: "number" } },
  { slug: "pc-build", name: "PC build / linh kiện máy tính", schemaConfig: { component: "string", brand: "string", model: "string", priceVnd: "number" } },
  { slug: "man-hinh-may-tinh", name: "Màn hình máy tính", schemaConfig: { screenInches: "number", resolution: "string", refreshRateHz: "number", panelType: "string", connectors: "string" } },
  { slug: "ban-phim-co", name: "Bàn phím cơ", schemaConfig: { layout: "string", switchType: "string", connection: "string", backlit: "boolean", hotswap: "boolean" } },
  { slug: "chuot-gaming", name: "Chuột gaming", schemaConfig: { dpiMax: "number", buttonCount: "number", weightGram: "number", connection: "string", sensor: "string" } },
  { slug: "tai-nghe-gaming", name: "Tai nghe gaming", schemaConfig: { driverSizeMm: "number", connection: "string", micType: "string", surroundSound: "boolean" } },

  // ─── AUDIO (6) ───
  { slug: "tai-nghe-tws", name: "Tai nghe true wireless", schemaConfig: { anc: "boolean", batteryHours: "number", bluetoothVersion: "string", waterproofIp: "string", codec: "string", driverSizeMm: "number" } },
  { slug: "tai-nghe-co-day", name: "Tai nghe có dây / IEM", schemaConfig: { driverType: "string", impedanceOhm: "number", connector: "string", micIncluded: "boolean" } },
  { slug: "tai-nghe-chup-tai", name: "Tai nghe chụp tai bluetooth", schemaConfig: { anc: "boolean", batteryHours: "number", driverSizeMm: "number", bluetoothVersion: "string", foldable: "boolean" } },
  { slug: "loa-bluetooth", name: "Loa bluetooth portable", schemaConfig: { outputW: "number", batteryHours: "number", waterproofIp: "string", bluetoothVersion: "string", weightGram: "number" } },
  { slug: "loa-thanh", name: "Loa thanh / soundbar TV", schemaConfig: { channelConfig: "string", outputW: "number", dolbyAtmos: "boolean", subwoofer: "boolean", connectivity: "string" } },
  { slug: "dac-amp", name: "DAC / AMP cho audiophile", schemaConfig: { dacChip: "string", outputW: "number", inputs: "string", balanced: "boolean" } },

  // ─── WEARABLES (5) ───
  { slug: "dong-ho-thong-minh", name: "Đồng hồ thông minh", schemaConfig: { screenInches: "number", batteryDays: "number", heartRate: "boolean", spo2: "boolean", gps: "boolean", waterproofMeters: "number", ecg: "boolean" } },
  { slug: "vong-deo-tay-thong-minh", name: "Vòng đeo tay thông minh", schemaConfig: { batteryDays: "number", heartRate: "boolean", spo2: "boolean", waterproofIp: "string", screenSizeInches: "number" } },
  { slug: "dong-ho-the-thao", name: "Đồng hồ thể thao Garmin / Polar", schemaConfig: { batteryDays: "number", gps: "boolean", multisport: "boolean", waterproofMeters: "number", altimeter: "boolean" } },
  { slug: "dong-ho-co", name: "Đồng hồ cơ (Automatic)", schemaConfig: { movement: "string", caseSizeMm: "number", waterResistanceM: "number", strap: "string", powerReserveHours: "number" } },
  { slug: "kinh-thuc-te-ao", name: "Kính thực tế ảo (VR / AR)", schemaConfig: { displayResolution: "string", refreshRateHz: "number", trackingType: "string", standalone: "boolean", batteryHours: "number" } },

  // ─── CAMERA & PHOTO (6) ───
  { slug: "may-anh-mirrorless", name: "Máy ảnh mirrorless", schemaConfig: { sensorSize: "string", megapixel: "number", videoMax: "string", ibis: "boolean", lensMount: "string", batteryShots: "number" } },
  { slug: "may-anh-dslr", name: "Máy ảnh DSLR", schemaConfig: { sensorSize: "string", megapixel: "number", videoMax: "string", lensMount: "string", batteryShots: "number" } },
  { slug: "action-cam", name: "Action cam (GoPro / Insta360 / DJI)", schemaConfig: { resolutionMax: "string", fpsMax: "number", waterproofMeters: "number", stabilization: "string", batteryMinutes: "number" } },
  { slug: "ong-kinh-may-anh", name: "Ống kính máy ảnh", schemaConfig: { focalLengthMm: "string", aperture: "string", mount: "string", stabilization: "boolean", weightGram: "number" } },
  { slug: "drone-flycam", name: "Drone / Flycam", schemaConfig: { cameraResolution: "string", flightTimeMinutes: "number", rangeKm: "number", weightGram: "number", obstacleAvoidance: "boolean" } },
  { slug: "webcam-livestream", name: "Webcam livestream", schemaConfig: { resolutionMax: "string", fpsMax: "number", fovDeg: "number", micIncluded: "boolean", autofocus: "boolean" } },

  // ─── SMART HOME (10) ───
  { slug: "robot-hut-bui-lau-nha", name: "Robot hút bụi - lau nhà", schemaConfig: { suctionPower: "number", batteryMinutes: "number", maxArea: "number", mopFunction: "boolean", selfEmpty: "boolean", mapping: "string", appControl: "boolean" } },
  { slug: "may-loc-khong-khi", name: "Máy lọc không khí", schemaConfig: { coverageArea: "number", cadr: "number", filterType: "string", noiseDbMax: "number", smartControl: "boolean", sensors: "string" } },
  { slug: "may-loc-nuoc", name: "Máy lọc nước", schemaConfig: { filterStages: "number", capacityLph: "number", filterType: "string", waterTankL: "number", hotColdFunction: "boolean", smartControl: "boolean" } },
  { slug: "camera-an-ninh-nha", name: "Camera an ninh nhà", schemaConfig: { resolutionMp: "number", nightVision: "boolean", twoWayAudio: "boolean", motionDetection: "boolean", localStorage: "string", appControl: "boolean" } },
  { slug: "khoa-cua-thong-minh", name: "Khoá cửa thông minh", schemaConfig: { unlockMethods: "string", batteryMonths: "number", camera: "boolean", remoteUnlock: "boolean", emergencyKey: "boolean" } },
  { slug: "den-thong-minh", name: "Đèn thông minh / smart bulb", schemaConfig: { wattage: "number", lumens: "number", colorChanging: "boolean", protocol: "string", dimmable: "boolean" } },
  { slug: "o-cam-thong-minh", name: "Ổ cắm thông minh", schemaConfig: { maxLoadW: "number", protocol: "string", energyMonitoring: "boolean", scheduling: "boolean" } },
  { slug: "loa-thong-minh", name: "Loa thông minh (Google / Alexa)", schemaConfig: { voiceAssistant: "string", outputW: "number", smartHubBuiltIn: "boolean", screenIncluded: "boolean" } },
  { slug: "cam-bien-thong-minh", name: "Cảm biến thông minh (cửa / chuyển động / nhiệt)", schemaConfig: { sensorType: "string", protocol: "string", batteryYears: "number", appControl: "boolean" } },
  { slug: "rem-thong-minh", name: "Rèm cửa thông minh / motor", schemaConfig: { motorType: "string", protocol: "string", batteryPowered: "boolean", maxWeightKg: "number" } },

  // ─── ĐỒ GIA DỤNG NHỎ (12) ───
  { slug: "noi-chien-khong-dau", name: "Nồi chiên không dầu", schemaConfig: { capacityL: "number", wattage: "number", maxTempC: "number", presetCount: "number", digitalControl: "boolean", nonStickCoating: "boolean" } },
  { slug: "noi-com-dien", name: "Nồi cơm điện", schemaConfig: { capacityL: "number", wattage: "number", innerPotMaterial: "string", cookingPrograms: "number", digitalDisplay: "boolean" } },
  { slug: "noi-ap-suat-dien", name: "Nồi áp suất điện", schemaConfig: { capacityL: "number", wattage: "number", maxPressureKpa: "number", presetCount: "number", safetyFeatures: "string" } },
  { slug: "may-xay-sinh-to", name: "Máy xay sinh tố", schemaConfig: { wattage: "number", capacityL: "number", speedSettings: "number", bladeMaterial: "string", warrantyMonths: "number" } },
  { slug: "may-rua-bat", name: "Máy rửa bát / chén", schemaConfig: { capacityPlates: "number", washPrograms: "number", waterUsageL: "number", energyClass: "string", noiseDbMax: "number" } },
  { slug: "may-pha-ca-phe", name: "Máy pha cà phê", schemaConfig: { type: "string", pressureBar: "number", capacityMl: "number", grinderBuiltIn: "boolean", milkFrother: "boolean" } },
  { slug: "binh-dun-sieu-toc", name: "Bình đun siêu tốc", schemaConfig: { capacityL: "number", wattage: "number", material: "string", temperatureControl: "boolean", autoShutoff: "boolean" } },
  { slug: "may-hut-bui-cam-tay", name: "Máy hút bụi cầm tay", schemaConfig: { suctionPaKa: "number", batteryMinutes: "number", dustBinL: "number", weightKg: "number", attachments: "string" } },
  { slug: "lo-vi-song", name: "Lò vi sóng", schemaConfig: { capacityL: "number", wattage: "number", powerLevels: "number", grill: "boolean", convection: "boolean" } },
  { slug: "may-say-toc", name: "Máy sấy tóc", schemaConfig: { wattage: "number", heatSettings: "number", ionic: "boolean", attachments: "string", weightGram: "number" } },
  { slug: "ban-la-hoi-nuoc", name: "Bàn là hơi nước đứng", schemaConfig: { wattage: "number", waterTankMl: "number", steamGramPerMin: "number", continuousSteam: "boolean" } },
  { slug: "may-ep-cham", name: "Máy ép chậm hoa quả", schemaConfig: { wattage: "number", rpm: "number", capacityMl: "number", augerMaterial: "string", warrantyMonths: "number" } },

  // ─── ĐỒ ĐIỆN LỚN (5) ───
  { slug: "may-giat", name: "Máy giặt", schemaConfig: { capacityKg: "number", type: "string", spinRpm: "number", inverter: "boolean", energyClass: "string", smartControl: "boolean" } },
  { slug: "tu-lanh", name: "Tủ lạnh", schemaConfig: { capacityL: "number", doorType: "string", inverter: "boolean", energyClass: "string", waterDispenser: "boolean", smartControl: "boolean" } },
  { slug: "dieu-hoa", name: "Điều hoà", schemaConfig: { btu: "number", inverter: "boolean", energyClass: "string", wifiControl: "boolean", starRating: "number" } },
  { slug: "tivi", name: "Tivi", schemaConfig: { screenInches: "number", resolution: "string", refreshRateHz: "number", hdr: "boolean", platform: "string", smartHome: "boolean" } },
  { slug: "binh-nong-lanh", name: "Bình nóng lạnh", schemaConfig: { capacityL: "number", heatingType: "string", wattage: "number", safetyFeatures: "string", warrantyMonths: "number" } },

  // ─── MỸ PHẨM & LÀM ĐẸP (10) ───
  { slug: "my-pham-duong-da", name: "Mỹ phẩm dưỡng da", schemaConfig: { skinType: "string", volumeMl: "number", keyIngredients: "string", spf: "number", fragranceFree: "boolean" } },
  { slug: "kem-chong-nang", name: "Kem chống nắng", schemaConfig: { spf: "number", paRating: "string", finishType: "string", waterResistant: "boolean", volumeMl: "number" } },
  { slug: "sua-rua-mat", name: "Sữa rửa mặt", schemaConfig: { skinType: "string", phLevel: "number", volumeMl: "number", keyIngredients: "string", foamType: "string" } },
  { slug: "serum-duong-da", name: "Serum dưỡng da", schemaConfig: { keyActive: "string", concentration: "string", skinConcern: "string", volumeMl: "number" } },
  { slug: "mat-na-duong-da", name: "Mặt nạ dưỡng da", schemaConfig: { type: "string", skinConcern: "string", keyIngredients: "string", piecesPerBox: "number" } },
  { slug: "son-moi", name: "Son môi / son tint", schemaConfig: { finishType: "string", colorName: "string", longLasting: "string", moisturizing: "boolean" } },
  { slug: "nuoc-hoa", name: "Nước hoa", schemaConfig: { fragranceFamily: "string", topNotes: "string", longevityHours: "number", sillage: "string", volumeMl: "number" } },
  { slug: "may-rua-mat-mini", name: "Máy rửa mặt mini", schemaConfig: { type: "string", batteryDays: "number", brushMaterial: "string", waterproofIp: "string" } },
  { slug: "dau-goi-cao-cap", name: "Dầu gội cao cấp", schemaConfig: { hairType: "string", keyIngredients: "string", sulfateFree: "boolean", volumeMl: "number" } },
  { slug: "tay-trang", name: "Nước tẩy trang", schemaConfig: { type: "string", skinType: "string", volumeMl: "number", oilFree: "boolean" } },

  // ─── SỨC KHOẺ & THỂ THAO (6) ───
  { slug: "may-do-huyet-ap", name: "Máy đo huyết áp", schemaConfig: { type: "string", memorySlots: "number", batteryType: "string", appConnect: "boolean", accuracyGrade: "string" } },
  { slug: "may-do-duong-huyet", name: "Máy đo đường huyết", schemaConfig: { stripType: "string", memorySlots: "number", sampleSecondsMax: "number", appConnect: "boolean" } },
  { slug: "ghe-massage", name: "Ghế massage", schemaConfig: { rollerSystem: "string", zeroGravity: "boolean", heatTherapy: "boolean", airbagsCount: "number", warrantyMonths: "number" } },
  { slug: "giay-chay-bo", name: "Giày chạy bộ", schemaConfig: { gender: "string", purpose: "string", dropMm: "number", weightGram: "number", outsoleMaterial: "string" } },
  { slug: "xe-dap-the-thao", name: "Xe đạp thể thao", schemaConfig: { frameMaterial: "string", wheelSize: "string", gearCount: "number", brakeType: "string", weightKg: "number" } },
  { slug: "thiet-bi-tap-gym", name: "Thiết bị tập gym tại nhà", schemaConfig: { equipmentType: "string", maxUserWeightKg: "number", foldable: "boolean", noiseDb: "number" } },

  // ─── MẸ & BÉ (5) ───
  { slug: "sua-cong-thuc", name: "Sữa công thức cho bé", schemaConfig: { ageRange: "string", brand: "string", weightG: "number", keyNutrients: "string", origin: "string" } },
  { slug: "ta-bim-em-be", name: "Tã bỉm em bé", schemaConfig: { type: "string", sizeRange: "string", pieceCount: "number", absorbencyHours: "number", origin: "string" } },
  { slug: "may-hut-sua", name: "Máy hút sữa", schemaConfig: { type: "string", suctionLevels: "number", batteryOperated: "boolean", noiseLevel: "string", flangeMm: "string" } },
  { slug: "xe-day-em-be", name: "Xe đẩy em bé", schemaConfig: { ageRange: "string", weightKg: "number", foldable: "boolean", reclineRange: "string", maxUserWeightKg: "number" } },
  { slug: "ghe-an-dam", name: "Ghế ăn dặm em bé", schemaConfig: { ageRange: "string", weightKg: "number", reclineRange: "string", removableTray: "boolean", washable: "boolean" } },

  // ─── PET (3) ───
  { slug: "thuc-an-cho-meo", name: "Thức ăn cho chó / mèo", schemaConfig: { petType: "string", ageRange: "string", weightKg: "number", proteinSource: "string", grainFree: "boolean" } },
  { slug: "cat-ve-sinh-meo", name: "Cát vệ sinh mèo", schemaConfig: { type: "string", weightKg: "number", clumping: "boolean", scented: "boolean", odorControlDays: "number" } },
  { slug: "phu-kien-thu-cung", name: "Phụ kiện thú cưng (vòng cổ / lồng / đồ chơi)", schemaConfig: { category: "string", petType: "string", sizeRange: "string", material: "string" } },

  // ─── OTHER (7) ───
  { slug: "qua-tang-cao-cap", name: "Quà tặng cao cấp", schemaConfig: { occasion: "string", priceRangeVnd: "string", category: "string" } },
  { slug: "noi-that-thong-minh", name: "Đồ nội thất thông minh", schemaConfig: { category: "string", material: "string", smartFeatures: "string", warrantyMonths: "number" } },
  { slug: "do-camping", name: "Đồ camping & dã ngoại", schemaConfig: { category: "string", peopleCapacity: "number", weightKg: "number", waterproof: "boolean" } },
  { slug: "balo-laptop-cao-cap", name: "Balo laptop cao cấp", schemaConfig: { laptopSizeInches: "number", capacityL: "number", waterproof: "boolean", material: "string", usbCharging: "boolean" } },
  { slug: "vali-keo", name: "Vali kéo du lịch", schemaConfig: { sizeInches: "number", material: "string", weightKg: "number", wheelCount: "number", expandable: "boolean" } },
  { slug: "thuc-pham-chuc-nang", name: "Thực phẩm chức năng", schemaConfig: { keyIngredient: "string", servingSize: "string", servingCount: "number", certification: "string" } },
  { slug: "sach-best-seller", name: "Sách best-seller", schemaConfig: { genre: "string", authorName: "string", pageCount: "number", language: "string", coverType: "string" } }
];

/**
 * Xoá sạch các Product hardcoded từ seed v1 (cùng ClickLog + ConversionWebhook cascade).
 * Match theo id list cố định — UUID column không filter được bằng startsWith,
 * và idempotent (chạy nhiều lần OK vì delete không-tồn-tại sẽ chỉ trả count=0).
 */
const LEGACY_SEEDED_PRODUCT_IDS = [
  "a1000001-0000-0000-0000-000000000001",
  "a1000001-0000-0000-0000-000000000002",
  "a1000001-0000-0000-0000-000000000003",
  "a1000001-0000-0000-0000-000000000004",
  "b2000001-0000-0000-0000-000000000001",
  "b2000001-0000-0000-0000-000000000002",
  "b2000001-0000-0000-0000-000000000003",
  "b2000001-0000-0000-0000-000000000004"
];

async function purgeLegacySeededProducts() {
  const legacy = await prisma.product.findMany({
    where: { id: { in: LEGACY_SEEDED_PRODUCT_IDS } },
    select: { id: true }
  });
  if (legacy.length === 0) return;
  const legacyIds = legacy.map((p) => p.id);

  const clickLogs = await prisma.clickLog.findMany({
    where: { productId: { in: legacyIds } },
    select: { trackingCode: true }
  });
  const trackingCodes = clickLogs.map((c) => c.trackingCode);
  if (trackingCodes.length > 0) {
    await prisma.conversionWebhook.deleteMany({
      where: { trackingCode: { in: trackingCodes } }
    });
  }
  const result = await prisma.product.deleteMany({ where: { id: { in: legacyIds } } });
  console.log(`[seed] Purged ${result.count} legacy seeded product(s).`);
}

async function cleanupRemovedNiches(keepSlugs) {
  const stale = await prisma.niche.findMany({
    where: { slug: { notIn: keepSlugs } },
    select: { id: true, slug: true }
  });
  if (stale.length === 0) return;
  const staleIds = stale.map((c) => c.id);
  const staleProducts = await prisma.product.findMany({
    where: { nicheId: { in: staleIds } },
    select: { id: true }
  });
  const staleProductIds = staleProducts.map((p) => p.id);
  if (staleProductIds.length > 0) {
    const staleClickIds = await prisma.clickLog.findMany({
      where: { productId: { in: staleProductIds } },
      select: { trackingCode: true }
    });
    const trackingCodes = staleClickIds.map((c) => c.trackingCode);
    if (trackingCodes.length > 0) {
      await prisma.conversionWebhook.deleteMany({
        where: { trackingCode: { in: trackingCodes } }
      });
    }
  }
  const result = await prisma.niche.deleteMany({ where: { id: { in: staleIds } } });
  console.log(
    `[seed] Removed ${result.count} stale niche(s): ${stale.map((c) => c.slug).join(", ")}`
  );
}

async function main() {
  await purgeLegacySeededProducts();
  await cleanupRemovedNiches(NICHES.map((c) => c.slug));

  for (const nicheSpec of NICHES) {
    await prisma.niche.upsert({
      where: { slug: nicheSpec.slug },
      update: {
        name: nicheSpec.name,
        schemaConfig: nicheSpec.schemaConfig,
        status: "ACTIVE"
      },
      create: {
        slug: nicheSpec.slug,
        name: nicheSpec.name,
        status: "ACTIVE",
        schemaConfig: nicheSpec.schemaConfig
      }
    });
  }
  console.log(`[seed] Upserted ${NICHES.length} niche(s).`);

  await prisma.promptTemplate.upsert({
    where: { name: "default-parser" },
    update: {
      content:
        "You are a strict extraction engine. Return only valid JSON that matches provided schema. Never return markdown.",
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "default-parser",
      content:
        "You are a strict extraction engine. Return only valid JSON that matches provided schema. Never return markdown.",
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  const blockSchemaSpec = [
    "OUTPUT 'blocks' là 1 mảng các object có 'type'. 9 loại block cho phép:",
    "",
    "1. { type: 'hero_quote', text: string, attribution?: string }",
    "   → Mở bài bằng câu chuyện/quote mạnh. text ≤ 50 từ.",
    "",
    "2. { type: 'criteria_grid', title?: string, items: [{ icon, title, body }] }",
    "   → 4-6 tiêu chí. icon ∈ ['battery','filter','noise','smart','size','money','shield','sparkle','clock','wifi']. body ≤ 40 từ.",
    "",
    "3. { type: 'product_spotlight', productId: REF, angle: string, pros?: string[], cons?: string[] }",
    "   → Spotlight 1 sản phẩm. productId ĐIỀN REF (P1/P2.../D1/D2...) từ [candidates] hoặc discoveredProducts — KHÔNG điền UUID, hệ thống tự thay.",
    "",
    "4. { type: 'callout', tone: 'info'|'warning'|'tip'|'success', title: string, body: string }",
    "   → Hộp nhấn. body ≤ 60 từ. TỐI ĐA 2 callout/bài.",
    "",
    "5. { type: 'prose', markdown: string }",
    "   → Đoạn văn dài. Cắt thành 2-3 prose ngắn xen kẽ các block khác hơn 1 prose dài.",
    "",
    "6. { type: 'comparison', productIds: REF[] }",
    "   → ≥ 2 ref (vd ['P1','P3','D1']).",
    "",
    "7. { type: 'pros_cons', pros: string[], cons: string[] }",
    "   → Mỗi list 3-5 items, mỗi item ≤ 15 từ.",
    "",
    "8. { type: 'faq', items: [{ q, a }] }",
    "   → 3-5 Q&A. answer 2-3 câu.",
    "",
    "9. { type: 'verdict', summary: string, bestFor?: string[], notFor?: string[] }",
    "   → Kết luận cuối. summary 2-3 câu.",
    "",
    "QUY TẮC:",
    "- Mỗi bài chọn 6-10 block. KHÔNG dùng hết tất cả loại.",
    "- KHÔNG dùng template cứng giữa các bài — flex thứ tự + chọn loại khác nhau.",
    "- KHÔNG đặt 2 block cùng type liền nhau (trừ prose, cố gắng xen visual).",
    "- Mọi ref trong productId/productIds phải có trong [candidates] hoặc trong discoveredProducts mà chính bạn liệt kê.",
    "- selectedRefs phải liệt kê toàn bộ ref đã dùng (cả P và D)."
  ].join("\n");

  const buyingGuidePrompt = [
    "Bạn là editor + writer chuyên xếp bài blog cho dealvault (site affiliate Việt Nam).",
    "Viết 1 BUYING GUIDE bằng tiếng Việt về chủ đề được cung cấp, dưới dạng STRUCTURED BLOCKS.",
    "",
    blockSchemaSpec,
    "",
    "GỢI Ý FLOW CHO BUYING_GUIDE (linh hoạt, không bắt buộc):",
    "- hero_quote hoặc prose ngắn mở bài (nỗi đau người mua)",
    "- criteria_grid (4-6 tiêu chí chọn mua)",
    "- 1-2 callout (vd warning: đừng tin lực hút quảng cáo)",
    "- 2-3 product_spotlight (phân khúc tiết kiệm/tầm trung/cao cấp)",
    "- comparison (nếu ≥ 2 sản phẩm)",
    "- faq",
    "- verdict",
    "",
    "RÀNG BUỘC:",
    "- Tone thân thiện, chuyên môn, KHÔNG sáo rỗng",
    "- Viết như đã trải nghiệm thật (dB ồn, thời gian sạc, app có lag không, mùi nhựa mới)",
    "- KHÔNG bao giờ tự nhận là AI",
    "- Tổng prose + criteria + faq ≥ 800 từ",
    "- Số liệu kỹ thuật cụ thể, ĐỪNG dùng giá/spec từ trí nhớ — chỉ trích từ [candidates] hoặc từ web search nguồn nằm trong [allowedDomains]",
    "- Nếu thị trường vừa có sản phẩm mới đáng đề cập mà KHÔNG nằm trong [candidates] → thêm vào discoveredProducts (ref D1, D2...) và DÙNG ref đó trong block",
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (60-70 ký tự)",',
    '  "slug": "string (kebab-case, không dấu, ≤ 80 ký tự)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)",',
    '  "selectedRefs": ["P1","P3","D1"],',
    '  "discoveredProducts": [{ "ref": "D1", "name": "...", "sourceUrl": "https://...", "reason": "..." }]',
    "}"
  ].join("\n");

  await prisma.promptTemplate.upsert({
    where: { name: "article-buying-guide" },
    update: {
      content: buyingGuidePrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "article-buying-guide",
      content: buyingGuidePrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  const reviewPrompt = [
    "Bạn là editor + writer chuyên review sản phẩm cho dealvault.",
    "Viết 1 REVIEW CHI TIẾT bằng tiếng Việt cho 1 sản phẩm cụ thể (contextProducts[0]), dưới dạng STRUCTURED BLOCKS.",
    "",
    blockSchemaSpec,
    "",
    "GỢI Ý FLOW CHO REVIEW (linh hoạt):",
    "- product_spotlight cho sản phẩm chính (mở đầu hoặc gần đầu)",
    "- prose 'cảm nhận chung sau khi dùng' — kể tình huống đời thường",
    "- criteria_grid (các tiêu chí đánh giá: pin, ồn, app, vệ sinh...)",
    "- pros_cons (BẮT BUỘC có cả pros và cons thật — không toàn ưu điểm)",
    "- 1 callout (warning hoặc tip)",
    "- comparison (nếu contextProducts có ≥ 2 — so với đối thủ)",
    "- verdict (kết luận: phù hợp ai, không phù hợp ai)",
    "",
    "RÀNG BUỘC:",
    "- NGÔI THỨ NHẤT — như người đã dùng vài tuần/tháng",
    "- Chi tiết cảm giác cụ thể: dB ồn ban đêm, độ ấm tay cầm, mùi nhựa mới, độ phản hồi app",
    "- BẮT BUỘC có ≥ 2 điểm yếu (cons / notFor) — KHÔNG có review toàn ưu điểm",
    "- KHÔNG bao giờ tự nhận là AI",
    "- Tổng nội dung ≥ 600 từ",
    "- KHÔNG dùng giá/spec từ trí nhớ — chỉ trích từ [candidates] hoặc web search từ [allowedDomains]",
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (có tên sản phẩm)",',
    '  "slug": "string (kebab-case)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)",',
    '  "selectedRefs": ["P1"],',
    '  "discoveredProducts": []',
    "}"
  ].join("\n");

  await prisma.promptTemplate.upsert({
    where: { name: "article-review" },
    update: {
      content: reviewPrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "article-review",
      content: reviewPrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  // ─── Article V2: phrase blacklist (Critic Agent loadable, 1 phrase per line) ───
  const blacklistContent = [
    "# Article V2 — phrase blacklist (Critic check). 1 phrase per line. Lines starting with # are comments.",
    "trong thời đại công nghệ 4.0",
    "không thể phủ nhận",
    "không thể phủ nhận rằng",
    "qua đó có thể thấy",
    "tóm lại",
    "đáng đồng tiền bát gạo",
    "tối ưu hóa trải nghiệm",
    "tối ưu hoá trải nghiệm",
    "trải nghiệm tuyệt vời",
    "nâng tầm trải nghiệm",
    "đỉnh cao của công nghệ",
    "lựa chọn hoàn hảo",
    "siêu phẩm",
    "không thể bỏ qua",
    "đắc lực",
    "đồng hành cùng bạn",
    "cuộc sống hiện đại",
    "ngày càng phổ biến",
    "ngày càng được ưa chuộng"
  ].join("\n");

  await prisma.promptTemplate.upsert({
    where: { name: "phrase-blacklist" },
    update: { content: blacklistContent, isActive: true, version: 1, activatedAt: new Date() },
    create: {
      name: "phrase-blacklist",
      content: blacklistContent,
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  // ─── Writer few-shot exemplars: section mẫu chất lượng cao để AI bắt chước văn phong ───
  // Mỗi exemplar = 1 section markdown thực, đại diện pattern affiliate blog VN
  // (prose ngắn → bullet → callout → image). Writer.stage.ts random pick 1 inject vào prompt.
  const EXEMPLARS = [
    {
      name: "writer-exemplar-screen",
      content: `Section heading: Màn hình AMOLED 6.7" cho trải nghiệm xem rất tốt

Tấm nền AMOLED 6.7 inch trên Redmi Turbo 5 cho màu sắc rực rỡ và độ tương phản sâu, đặc biệt khi xem phim Netflix hoặc YouTube HDR.

Thông số đáng chú ý:
- Độ phân giải 2712 × 1220 pixel (cao hơn Full HD)
- Tần số quét 120Hz, hỗ trợ Dolby Vision và HDR10+
- Độ sáng tối đa 1800 nits — đủ rõ ngoài trời nắng gắt
- Kính cường lực Corning Gorilla Glass Victus

Điểm trừ nhỏ: viền dưới hơi dày hơn 3 cạnh còn lại — nhìn kỹ mới thấy, không ảnh hưởng trải nghiệm.`
    },
    {
      name: "writer-exemplar-battery",
      content: `Section heading: Pin 5500mAh dùng cả ngày thoải mái

Với pin 5500mAh và sạc nhanh 90W, Redmi Turbo 5 thuộc top cấu hình pin trong tầm giá 8 triệu.

Kết quả test thực tế (sạc đầy 100% lúc 7h sáng):
- Xem YouTube 1 tiếng + lướt mạng xã hội 2 tiếng → còn 78%
- Chơi Liên Quân 30 phút mức cao nhất → tụt 8%
- 21h tối còn 22% — đủ dùng thêm 1-2 tiếng

Sạc 0 → 100% mất 38 phút theo dây cáp + củ sạc đi kèm trong hộp. Tốc độ này nhanh hơn iPhone 15 Pro Max (khoảng 90 phút) ở cùng dung lượng pin.`
    },
    {
      name: "writer-exemplar-verdict",
      content: `Section heading: Có nên mua Redmi Turbo 5 không?

Redmi Turbo 5 là lựa chọn đáng cân nhắc nhất tầm 8 triệu đồng cho game thủ casual và người dùng đa nhiệm. Camera và phần mềm chưa thuộc top, nhưng hiệu năng + pin + màn hình bù lại tốt.

**Nên mua nếu bạn:**
- Cần điện thoại chơi game cấu hình cao trong 1-2 năm tới
- Ưu tiên pin trâu, sạc nhanh
- Ngân sách 7-9 triệu, không cần camera đỉnh

**Cân nhắc Poco F7 hoặc Samsung A55 nếu:**
- Bạn chụp ảnh nhiều, đặc biệt chân dung
- Ưu tiên phần mềm sạch, không quảng cáo
- Cần hỗ trợ cập nhật phần mềm dài hạn (Samsung 5 năm)`
    }
  ];

  for (const ex of EXEMPLARS) {
    await prisma.promptTemplate.upsert({
      where: { name: ex.name },
      update: { content: ex.content, isActive: true, version: 1, activatedAt: new Date() },
      create: {
        name: ex.name,
        content: ex.content,
        isActive: true,
        version: 1,
        activatedAt: new Date(),
        createdBy: "seed"
      }
    });
  }
  console.log(`[seed] Upserted ${EXEMPLARS.length} writer exemplar(s).`);

  // ─── Article V2: default authors với voiceProfile khác nhau ───
  const authors = [
    {
      slug: "minh-anh",
      name: "Minh Anh",
      bio: "Biên tập viên công nghệ, 5 năm review thiết bị nhà thông minh và đồ gia dụng.",
      voiceProfile: {
        tone: "conversational",
        vocabRange: "neutral",
        sentenceLength: "mixed",
        englishLoanwords: "minimal",
        openingPatterns: ["scenario", "question", "stat"],
        quirks: ["hay so sánh với đời sống thực tế", "thi thoảng dùng câu hỏi tu từ"]
      }
    },
    {
      slug: "quang-huy",
      name: "Quang Huy",
      bio: "Kỹ sư điện tử, tập trung phân tích thông số kỹ thuật và benchmark.",
      voiceProfile: {
        tone: "technical",
        vocabRange: "formal",
        sentenceLength: "long",
        englishLoanwords: "moderate",
        openingPatterns: ["stat", "contrarian", "myth-bust"],
        quirks: ["dùng số liệu cụ thể", "luôn cite spec sheet"]
      }
    },
    {
      slug: "thu-ha",
      name: "Thu Hà",
      bio: "Cây bút lifestyle, kể chuyện trải nghiệm sản phẩm theo góc nhìn người dùng phổ thông.",
      voiceProfile: {
        tone: "storytelling",
        vocabRange: "casual",
        sentenceLength: "short",
        englishLoanwords: "minimal",
        openingPatterns: ["anecdote", "scenario", "vivid"],
        quirks: ["mở bài bằng tình huống đời thường", "kết thường có lời khuyên ngắn"]
      }
    },
    {
      slug: "tuan-kiet",
      name: "Tuấn Kiệt",
      bio: "Chuyên review góc nhìn phản biện — chỉ ra điểm yếu trước, rồi cân nhắc giá trị.",
      voiceProfile: {
        tone: "witty",
        vocabRange: "neutral",
        sentenceLength: "medium",
        englishLoanwords: "minimal",
        openingPatterns: ["contrarian", "myth-bust", "news"],
        quirks: ["thẳng thắn về điểm yếu", "không ngại chê"]
      }
    }
  ];

  for (const a of authors) {
    await prisma.author.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        bio: a.bio,
        voiceProfile: a.voiceProfile,
        isActive: true
      },
      create: {
        slug: a.slug,
        name: a.name,
        bio: a.bio,
        voiceProfile: a.voiceProfile,
        expertiseNiches: [],
        isActive: true
      }
    });
  }

  // Assign all niches as expertise cho author đầu tiên (Minh Anh) — admin sau có thể chỉnh.
  const allNiches = await prisma.niche.findMany({ select: { id: true } });
  await prisma.author.update({
    where: { slug: "minh-anh" },
    data: { expertiseNiches: allNiches.map((n) => n.id) }
  });

  console.log(`Seeded ${authors.length} authors + phrase-blacklist template.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
