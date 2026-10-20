/* Kho hỏi – đáp Thủ tục hành chính của Đảng (bản dành cho tỉnh Lào Cai)
   Biên tập từ kho QA "Hỗ trợ kỹ thuật CDSTUHUE" (tab QA TTHC), bản cập nhật 07–08/10/2026.
   Trường:
     id  – mã câu hỏi (giữ theo kho gốc để đối chiếu)
     c   – nhóm chủ đề (khóa trong HD_CATS)
     q   – câu hỏi
     a   – trả lời (mảng đoạn; đoạn bắt đầu bằng "1." "2." … hiển thị dạng bước)
     alt – cách hỏi khác / từ khóa tìm kiếm
     st  – 'ok'   : đã có hướng xử lý
           'note' : có hướng xử lý, cần đối chiếu văn bản/quy định khi áp dụng
           'open' : chưa có lời giải xác nhận → liên hệ đầu mối hỗ trợ tỉnh Lào Cai
   Muốn thêm câu hỏi: chép một khối { … } và sửa nội dung. */

window.HD_UPDATED = '20/10/2026';

window.HD_CONTACT = {
  name: 'Đầu mối hỗ trợ kỹ thuật TTHC tỉnh Lào Cai',
  // Điền thông tin liên hệ thực tế (số điện thoại, nhóm Zalo…) vào dòng dưới; để trống thì trang chỉ hiện tên đầu mối.
  detail: ''
};

window.HD_CATS = {
  dp: 'Kê khai & nộp đảng phí',
  tt: 'Chuyển sinh hoạt & nhận xét nơi cư trú',
  pb: 'Phân bổ & tài khoản ngân hàng',
  dt: 'Trường hợp đặc biệt',
  pq: 'Phân quyền & vai trò',
  db: 'Đồng bộ dữ liệu & sáp nhập',
  ks: 'Chữ ký số',
  dn: 'Đăng nhập, giao diện & tài liệu',
  cg: 'Chưa có lời giải – liên hệ đầu mối Lào Cai'
};

window.HD_DATA = [
/* ===== KÊ KHAI & NỘP ĐẢNG PHÍ ===== */
{id:'QA110',c:'dp',st:'ok',
 q:'Đảng viên tự kê khai và thanh toán đảng phí theo các bước nào?',
 a:['1. Vào Thu, nộp đảng phí → Nộp hồ sơ/Kê khai → kiểm tra dữ liệu và số tiền → nộp hồ sơ.',
    '2. Chờ Bí thư/Ủy viên tài chính phê duyệt; hồ sơ chuyển sang trạng thái “Chờ nộp”.',
    '3. Chọn Đóng đảng phí/Thanh toán → kiểm tra số tiền → quét mã QR thanh toán.',
    '4. Thanh toán xong, hồ sơ chuyển trạng thái “Hoàn thành”.'],
 alt:'luồng chuẩn nộp đảng phí; tự khai rồi thanh toán; khi nào được quét QR; các bước nộp'},

{id:'QA111',c:'dp',st:'ok',
 q:'Khai hộ và nộp hộ đảng phí thực hiện thế nào?',
 a:['Khai hộ: tra cứu người được khai bằng CCCD + họ tên + ngày sinh, kiểm tra/nhập dữ liệu rồi gửi hồ sơ.',
    'Nộp hộ: vào Thu nộp đảng phí cho hộ → Đóng đảng phí → nhập lại 3 thông tin (CCCD, họ tên, ngày sinh) → kiểm tra số tiền → quét QR.'],
 alt:'tra cứu người được khai hộ; đóng đảng phí hộ; nộp thay người khác'},

{id:'QA007',c:'dp',st:'ok',
 q:'Tờ khai đảng phí đi qua các trạng thái nào? Vì sao có hồ sơ chưa phê duyệt mà đã sang “Đã nộp”?',
 a:['Đảng viên tự khai → Bí thư/Ủy viên tài chính duyệt → “Chờ nộp” → thanh toán → “Đã nộp/Hoàn thành”.',
    'Bí thư/Ủy viên tài chính khai hộ → hồ sơ có thể vào thẳng “Chờ nộp”.',
    'Đảng viên được miễn 100% → hồ sơ có thể vào thẳng “Đã nộp”.',
    'Nếu hồ sơ đi khác các luồng trên thì kiểm tra lại cấu hình, trạng thái miễn/giảm của đảng viên.'],
 alt:'tờ khai chưa duyệt đã vào đã nộp; không thấy tờ khai ở tài khoản BTCB; hồ sơ sang chờ nộp khi nào; trạng thái hồ sơ'},

{id:'QA026',c:'dp',st:'ok',
 q:'Ai phê duyệt hồ sơ đảng phí? Ủy viên tài chính có phê duyệt được không?',
 a:['Đảng viên tự khai thì người có quyền ở chi bộ (Bí thư hoặc Ủy viên tài chính) phải duyệt trước khi hồ sơ sang “Chờ nộp”.',
    'Ủy viên tài chính phê duyệt được nếu đã được phân đúng quyền. Không thấy nút phê duyệt → kiểm tra lại phân quyền của tài khoản.'],
 alt:'ai duyệt hồ sơ đảng phí; ủy viên tài chính duyệt; hồ sơ chưa sang chờ nộp; không thấy nút phê duyệt'},

{id:'QA030',c:'dp',st:'ok',
 q:'Chức năng tự động phê duyệt đảng phí hàng tháng hoạt động khi nào?',
 a:['Dùng cho đảng viên có mức đóng cố định, không thay đổi. Khi đã cấu hình, tháng sau hồ sơ tự sinh và tự phê duyệt, Bí thư không phải duyệt lại.',
    'Nếu mức đóng thay đổi thì phải khai/điều chỉnh lại theo tình trạng thực tế.'],
 alt:'auto duyệt tháng sau; hồ sơ tự sinh; mức đóng không đổi; bí thư có phải duyệt lại không'},

{id:'QA052',c:'dp',st:'ok',
 q:'Sau lần kê khai đầu, các tháng sau có phải kê khai lại từ đầu không?',
 a:['Mức đóng cố định: chỉ khai một lần, các tháng sau hệ thống tự sinh hồ sơ.',
    'Mức đóng thay đổi (ví dụ lương BHXH thay đổi): cần khai/điều chỉnh lại theo dữ liệu thực tế.'],
 alt:'tháng nào cũng phải khai lại không; hồ sơ tự sinh; BHXH thay đổi thì làm gì'},

{id:'QA034',c:'dp',st:'ok',
 q:'Hồ sơ đã được phê duyệt nhưng đảng viên chưa thanh toán, muốn kê khai lại thì làm thế nào?',
 a:['1. Vào mục “Chờ nộp”, chọn hồ sơ và Hủy phê duyệt → hồ sơ quay về “Chờ phê duyệt”.',
    '2. Mở chi tiết hồ sơ và Từ chối hồ sơ.',
    '3. Đảng viên kê khai lại.'],
 alt:'đã phê duyệt nhưng chưa đóng; sửa hồ sơ; làm lại tờ khai; hủy phê duyệt; từ chối hồ sơ'},

{id:'QA017',c:'dp',st:'ok',
 q:'Số tiền đảng phí lấy từ BHXH thấp hơn thực tế hoặc sai mức thì chỉnh ở đâu?',
 a:['Điều chỉnh mức đóng tại hồ sơ khi hồ sơ còn ở trạng thái “Chờ phê duyệt”.',
    'Khi khai hộ, nếu dữ liệu BHXH không tự ra đúng thì nhập đúng số tiền phải đóng trước khi phê duyệt để tránh phát sinh hoàn tiền.',
    'Vị trí chức năng có thể thay đổi theo phiên bản; kiểm tra trên giao diện hiện hành.'],
 alt:'BHXH đồng bộ sai tiền; không thấy nút sửa; mức đóng thấp hơn thực tế; sửa số tiền trước khi duyệt'},

{id:'QA057',c:'dp',ref:'QA085',st:'note',
 q:'Hệ thống tự lấy mức BHXH/1% không đúng đối tượng thì có chọn lại và nhập số tiền khác được không?',
 a:['Được. Bỏ lựa chọn theo BHXH khi không phù hợp, chọn nhóm/đối tượng tương ứng rồi nhập số tiền theo đúng nghiệp vụ.',
    'Khi khai hộ, nếu BHXH không tự ra đúng thì nhập đúng số tiền thực tế phải đóng trước khi duyệt.',
    'Lưu ý: phải chọn đúng đối tượng theo quy định, không chỉ để sửa số tiền.'],
 alt:'BH tự nhảy 1%; BHXH tự nguyện; muốn nhập số tiền khác; chọn không có BHXH'},

{id:'QA006',c:'dp',st:'ok',
 q:'Đảng viên được miễn 100% hoặc giảm 30/50/70% thì khai hồ sơ đảng phí thế nào?',
 a:['Trước khi kê khai, cập nhật đúng tình trạng miễn/giảm của đảng viên.',
    'Miễn 100%: nếu hệ thống đã cấu hình đúng trạng thái miễn, hồ sơ đi thẳng sang “Đã nộp”, không phát sinh bước thanh toán.',
    'Giảm 30/50/70%: khi khai hộ, nếu hệ thống không tự tính đúng thì nhập số tiền thực tế còn phải đóng sau giảm. Ví dụ mức 100.000 đồng giảm 30% thì nhập 70.000 đồng.'],
 alt:'miễn đảng phí; miễn 100% vẫn bắt nhập tiền; giảm đảng phí nhập bao nhiêu; danh sách miễn đảng phí'},

{id:'QA062',c:'dp',st:'ok',
 q:'Đã điền đủ thông tin kê khai nhưng không hiện nút “Tiếp theo” thì xử lý thế nào?',
 a:['Kiểm tra định dạng số tiền — nguyên nhân thường gặp là số tiền nhập không đúng định dạng. Sửa lại rồi thử tiếp.',
    'Đúng định dạng mà vẫn không hiện nút thì liên hệ đầu mối hỗ trợ.'],
 alt:'kê khai xong không đi tiếp được; không có nút tiếp theo'},

{id:'QA054',c:'dp',st:'ok',
 q:'Quét mã QR đang hiển thị nhưng ngân hàng không thanh toán được, có phải sai mã không?',
 a:['Mã QR xuất hiện sớm trên giao diện có thể chưa phải mã thanh toán. Cần bấm đúng bước Đóng đảng phí/Thanh toán để hệ thống sinh mã thanh toán rồi mới quét.'],
 alt:'QR; quét code trên màn hình không được; phải bấm đâu để ra QR thanh toán; mã QR không thanh toán được'},

{id:'QA011',c:'dp',st:'open',
 q:'Bấm “Tiếp theo” để nộp tiền nhưng báo mã/code thanh toán hết hạn và không sinh mã mới thì xử lý thế nào?',
 a:['Chưa có cách tự xử lý được xác nhận. Dừng thanh toán trên mã đã hết hạn, chụp màn hình lỗi và gửi đầu mối hỗ trợ kiểm tra.'],
 alt:'code hết hạn; mã hết hạn; không tạo mã mới; quay ra chờ rồi vẫn lỗi'},

{id:'QA055',c:'dp',st:'ok',
 q:'Khi nộp đảng phí, dùng tài khoản ngân hàng cá nhân hay tài khoản của chi bộ?',
 a:['Mỗi đảng viên dùng tài khoản cá nhân của mình để thanh toán.',
    'Tài khoản của chi bộ/tổ chức đảng không dùng để đóng thay từng khoản đảng phí; tài khoản đó dùng để nhận phần đảng phí được phân bổ lại.'],
 alt:'dùng TK cá nhân của đại diện cấp ủy để đóng; lấy TK tổ chức nộp thay; tài khoản thanh toán'},

{id:'QA024',c:'dp',st:'ok',
 q:'Đảng viên đã chuyển đảng phí thẳng vào tài khoản chi bộ, không qua dichvucong.dcs.vn thì xử lý thế nào?',
 a:['Khoản đó là nộp trực tiếp bên ngoài, không được tính là hồ sơ nộp trên hệ thống.',
    'Muốn ghi nhận theo luồng TTHC thì chi bộ hoàn lại khoản tiền đó cho đảng viên rồi đề nghị đảng viên nộp lại qua hệ thống.'],
 alt:'chuyển thẳng vào tài khoản chi bộ; nộp ngoài hệ thống; không qua dịch vụ công; đưa khoản đó vào TTHC'},

{id:'QA013',c:'dp',st:'ok',
 q:'Sau khi 100% đảng viên đã nộp, chi bộ có phải nộp tiếp lên cấp trên không?',
 a:['Không. Khi đảng viên nộp thành công trên TTHC, tiền đã đi vào luồng thu tập trung; chi bộ không cần thao tác “nộp tiếp” lên cấp trên.',
    'Hệ thống sẽ phân bổ lại theo tỷ lệ đã xác nhận.'],
 alt:'đảng viên nộp xong 100% rồi chi bộ làm gì; có chuyển tiền lên cấp trên nữa không; nộp cấp trên'},

{id:'QA005',c:'dp',st:'ok',
 q:'Đảng viên nộp thừa hoặc nộp sai số tiền thì hoàn tiền thế nào?',
 a:['1. Đảng viên tự gửi yêu cầu hoàn tiền trên hệ thống.',
    '2. Bí thư chi bộ duyệt yêu cầu; tiền hoàn về tài khoản đảng viên đã khai báo.',
    'Hiện chỉ hoàn được với kỳ chưa thực hiện phân bổ. Kỳ đã phân bổ thì liên hệ đầu mối hỗ trợ.'],
 alt:'hoàn tiền; nộp thừa; đóng dư; thu hồi tiền thừa; đóng 50k lỡ nộp 200k; BHXH tự nhảy sai số tiền'},

{id:'QA033',c:'dp',st:'open',
 q:'Đã nộp đảng phí nhưng tính sai nên bị thiếu thì nộp bù thế nào?',
 a:['Chưa có quy trình nộp bù được xác nhận chính thức. Việc “để tháng sau truy thu” mới là ý kiến trao đổi, chưa phải hướng dẫn chuẩn.',
    'Ghi rõ đảng viên, kỳ nộp, số tiền thiếu và liên hệ đầu mối hỗ trợ để được hướng dẫn theo trạng thái hồ sơ.'],
 alt:'nộp bù; nộp thiếu; truy thu; thiếu tiền; bổ sung đảng phí; tính sai mức đóng'},

{id:'QA053',c:'dp',st:'open',
 q:'Trong cùng một tháng có tạo thêm hồ sơ để nộp bổ sung lần hai được không?',
 a:['Chưa có hướng dẫn chính thức xác nhận việc tạo hồ sơ nộp bổ sung lần hai trong cùng tháng.',
    'Nếu phát sinh nộp thiếu trong tháng, liên hệ đầu mối hỗ trợ trước khi thực hiện.'],
 alt:'nộp thêm lần 2 trong tháng; một tháng nộp nhiều lần; tạo hồ sơ bổ sung'},

{id:'QA035',c:'dp',st:'open',
 q:'Đã thêm phần truy thu vào hồ sơ, sau đó muốn hủy/từ chối nhưng phần truy thu bị kẹt thì làm sao?',
 a:['Phần truy thu đã kẹt thì người dùng không tự hủy được; gửi mã hồ sơ cho đầu mối hỗ trợ xử lý.',
    'Khuyến nghị: chưa thêm truy thu khi chưa chắc quy trình.'],
 alt:'truy thu không hủy được; từ chối hồ sơ nhưng truy thu còn lại; kẹt hồ sơ'},

{id:'QA060',c:'dp',st:'ok',
 q:'Đơn vị chưa chính thức triển khai thu nộp trên hệ thống nhưng đã có đảng viên tự nộp thì xử lý hồ sơ đó thế nào?',
 a:['Không phê duyệt hồ sơ. Giữ nguyên và chỉ xử lý tiếp khi có chỉ đạo triển khai chính thức.'],
 alt:'chưa triển khai mà đảng viên đã nộp; hồ sơ phát sinh trước ngày mở; tự nộp sớm'},

{id:'QA061',c:'dp',st:'open',
 q:'Hồ sơ cũ vẫn còn trong danh sách nhưng bấm Thanh toán báo “không tồn tại” là sao?',
 a:['Nếu hồ sơ thuộc đợt dữ liệu đã được thông báo xóa/làm sạch thì đó chỉ là bản ghi hiển thị cũ, không thể thanh toán tiếp.',
    'Nếu không thuộc đợt làm sạch dữ liệu thì gửi mã hồ sơ và ảnh lỗi cho đầu mối hỗ trợ kiểm tra.'],
 alt:'hồ sơ vẫn thấy nhưng không thanh toán được; hồ sơ cũ sau reset; thanh toán không tồn tại'},

{id:'QA063',c:'dp',st:'open',
 q:'Chưa xác nhận tỷ lệ phân bổ thì có phê duyệt thu đảng phí trước được không?',
 a:['Chưa có nguồn xác nhận chắc chắn. Điều đã rõ: muốn tiền được phân bổ về đơn vị thì đơn vị phải có tài khoản ngân hàng hợp lệ và đã xác nhận đúng tỷ lệ.',
    'Khuyến nghị các đơn vị tại Lào Cai hoàn tất xác nhận tỷ lệ phân bổ trước; nếu đang vướng thứ tự thao tác thì hỏi đầu mối hỗ trợ.'],
 alt:'chưa xác nhận phân bổ vẫn duyệt hồ sơ được không; duyệt thu trước'},

/* ===== PHÂN BỔ & TÀI KHOẢN NGÂN HÀNG ===== */
{id:'QA003',c:'pb',st:'ok',
 q:'Đảng viên nộp đảng phí trên hệ thống thì tiền đi đâu? Tài khoản ngân hàng của chi/đảng bộ dùng để làm gì?',
 a:['Tiền nộp qua TTHC đi vào tài khoản trung gian/Trung ương trước.',
    'Tài khoản ngân hàng của tổ chức đảng dùng để nhận phần đảng phí được phân bổ lại. Để nhận phân bổ, tài khoản phải được khai báo/xác thực và tổ chức phải xác nhận tỷ lệ phân bổ.'],
 alt:'tiền đảng phí đi đâu; tài khoản trung gian; tài khoản TW; chi bộ chưa có tài khoản thì tiền nằm đâu'},

{id:'QA031',c:'pb',st:'ok',
 q:'Đảng viên quét QR nộp đảng phí nhưng tiền không vào tài khoản chi bộ, có phải lỗi không?',
 a:['Không phải lỗi. Tiền vào tài khoản trung gian/Trung ương trước, sau đó chi bộ nhận phần được phân bổ lại.',
    'Kiểm tra trạng thái thanh toán của hồ sơ và điều kiện nhận phân bổ (tài khoản ngân hàng, tỷ lệ phân bổ).'],
 alt:'quét QR thấy tiền vào tài khoản khác; sao tài khoản chi bộ chưa nhận; QR thanh toán đi đâu'},

{id:'QA014',c:'pb',st:'note',
 q:'Sau khi nộp, bao lâu tiền được phân bổ về tài khoản thụ hưởng? Phân bổ từng món hay gộp?',
 a:['Phân bổ theo tháng, một lần cho tổng số đảng viên đã đóng trong kỳ (không phân bổ từng giao dịch).',
    'Thời điểm cụ thể phụ thuộc lịch chạy phân bổ của hệ thống.'],
 alt:'thời gian phân bổ; tiền về khi nào; phân bổ theo tháng; từng món hay gộp'},

{id:'QA004',c:'pb',st:'ok',
 q:'Tỷ lệ phân bổ đảng phí hiển thị sai (50/50, 70/30…) hoặc không sửa được thì làm thế nào?',
 a:['Không tự sửa tỷ lệ % trực tiếp trên TTHC. Tỷ lệ được sinh từ Loại/Phân loại cơ quan, đơn vị trên CSDL 4.0.',
    '1. Kiểm tra Loại cơ quan/đơn vị và Phân loại cơ quan/đơn vị trên CSDL 4.0, sửa nếu sai.',
    '2. Đồng bộ lại sang TTHC.',
    '3. Kiểm tra tỷ lệ và vào chức năng Xác nhận tỷ lệ phân bổ.',
    'Dữ liệu nguồn đã đúng mà tỷ lệ vẫn sai → gửi đầu mối hỗ trợ, không tự đặt tỷ lệ khác để “vá”.'],
 alt:'tỷ lệ phân bổ; tỉ lệ; 50-50; 70-30; xác nhận phân bổ; sửa tỷ lệ; mặc định 50-50 không sửa được; phân loại cơ quan; sai phân loại đơn vị',
 ref:'QA068'},

{id:'QA080',c:'pb',st:'ok',
 q:'Đã cập nhật “Phân loại cơ quan, đơn vị” trên CSDL 4.0 nhưng TTHC vẫn chưa hiển thị?',
 a:['Sửa đúng cả “Loại cơ quan/đơn vị” và “Phân loại cơ quan/đơn vị” trên 4.0, rồi đồng bộ lại TTHC.',
    'Chỉ xác nhận tỷ lệ khi dữ liệu đã lên đúng trên TTHC.'],
 alt:'phân loại trên 4.0 đầy đủ nhưng TTHC còn trống; tỷ lệ chưa đổi; đồng bộ phân loại'},

{id:'QA016',c:'pb',st:'note',
 q:'Chi bộ/đảng bộ có cần tài khoản ngân hàng riêng không? Tài khoản đó dùng vào việc gì?',
 a:['Tài khoản ngân hàng của tổ chức đảng dùng để nhận phần đảng phí được phân bổ lại, không phải nơi đảng viên chuyển tiền trực tiếp.',
    'Đơn vị muốn nhận phân bổ thì phải khai báo/xác thực tài khoản trên hệ thống.',
    'Việc mỗi chi bộ trực thuộc có bắt buộc mở tài khoản riêng hay dùng tài khoản cấp trên phụ thuộc loại hình tổ chức và hướng dẫn triển khai của tỉnh.'],
 alt:'mở tài khoản ngân hàng; chi bộ trường có cần mở tài khoản; đảng bộ xã/phường có cần tài khoản; tài khoản nhận phân bổ'},

{id:'QA040',c:'pb',st:'ok',
 q:'Không thấy nút “Thêm mới” để cập nhật tài khoản ngân hàng thì kiểm tra gì?',
 a:['Dùng tài khoản quản trị, bỏ chọn ô “Cơ quan/đơn vị thuộc vùng trắng” — nút thêm tài khoản ngân hàng sẽ hiện.',
    'Đã bỏ chọn mà vẫn không có nút → kiểm tra lại phân quyền.'],
 alt:'không thêm được TK ngân hàng; vùng trắng; bỏ check vùng trắng; thiếu nút thêm mới'},

{id:'QA049',c:'pb',st:'open',
 q:'Tài khoản đảng phí của Đảng ủy có dùng tài khoản Kho bạc được không?',
 a:['Chưa có xác nhận tài khoản Kho bạc dùng được làm tài khoản nhận phân bổ đảng phí. Không cấu hình theo suy đoán; hỏi đầu mối tài chính/triển khai của tỉnh.'],
 alt:'TK kho bạc nhận đảng phí; tài khoản đảng ủy dùng loại nào'},

{id:'QA064',c:'pb',st:'note',
 q:'Sau sáp nhập/thay Bí thư, tài khoản ngân hàng của tổ chức có đổi tên/người đại diện mà giữ nguyên số tài khoản được không?',
 a:['Tùy quy định từng ngân hàng (đã có trường hợp Agribank cho đổi người đại diện, giữ số tài khoản).',
    'Liên hệ ngân hàng làm thủ tục, sau đó kiểm tra lại tên tài khoản trên hệ thống.'],
 alt:'đổi bí thư thì đổi chủ tài khoản; giữ nguyên số TK; đổi tên TK tổ chức'},

/* ===== TRƯỜNG HỢP ĐẶC BIỆT ===== */
{id:'QA008',c:'tt',st:'note',
 q:'Đảng viên chuyển sinh hoạt tạm thời nộp đảng phí ở đâu, có khai trên TTHC không?',
 a:['Nộp đảng phí tại chi bộ sinh hoạt tạm thời, bằng tiền mặt; chi bộ cũ chỉ quản lý danh sách, không thu đảng phí.',
    'Trường hợp chuyển sinh hoạt tạm thời không khai hồ sơ thu/nộp đảng phí trên TTHC.'],
 alt:'chuyển sinh hoạt tạm thời; chi bộ tạm thời; nộp tiền mặt; chi bộ cũ hay chi bộ mới thu'},

{id:'QA059',c:'tt',st:'ok',
 q:'Đảng viên chuyển sinh hoạt tạm thời, trên 4.0 đã ở đơn vị tạm thời nhưng TTHC vẫn ở chi bộ cũ — có phải lỗi?',
 a:['Không nhất thiết là lỗi. Chuyển sinh hoạt tạm thời không cắt số lượng khỏi chi bộ cũ (cắt mới là sai), nên TTHC còn hiển thị ở chi bộ cũ là phù hợp.',
    'Nếu là chuyển sinh hoạt chính thức thì mới xử lý theo nhóm lỗi đồng bộ chuyển đơn vị.'],
 alt:'chuyển tạm có cắt khỏi chi bộ cũ không; quân số chi bộ cũ; TTHC vẫn ở chi bộ thôn',
 ref:'QA058'},

{id:'QA010',c:'dt',st:'note',
 q:'Đảng viên nghỉ thai sản, hệ thống vẫn lấy lương đóng BHXH tháng trước để tính đảng phí thì căn cứ nào?',
 a:['Bình thường dùng lương đóng BHXH tháng trước liền kề.',
    'Nếu nghỉ ốm đau/thai sản và không đóng BHXH thì lấy mức trợ cấp ốm đau/thai sản do cơ quan BHXH chi trả làm căn cứ và điều chỉnh số tiền trên hồ sơ.'],
 alt:'thai sản; nghỉ thai sản; trợ cấp thai sản; ốm đau; mức tính đảng phí'},

{id:'QA036',c:'dt',st:'open',
 q:'Đảng viên dự bị không hiển thị hoặc không kê khai nộp đảng phí được thì xử lý thế nào?',
 a:['Kiểm tra hồ sơ đảng viên dự bị trên CSDL 4.0 đã đúng trạng thái và thông tin chưa.',
    'Không tự điền “ngày chính thức” hay đổi trạng thái đảng viên để vượt lỗi. Dữ liệu nguồn đã đúng mà vẫn lỗi → gửi trường hợp cụ thể cho đầu mối hỗ trợ.'],
 alt:'đảng viên dự bị không hiện; không nộp được đảng phí; dự bị không kê khai được'},

{id:'QA027',c:'dt',st:'open',
 q:'Đảng viên lớn tuổi không có số điện thoại, khi kê khai hộ có dùng số người thân được không?',
 a:['Chưa có hướng dẫn xác nhận. Không tự thay số; hỏi đầu mối hỗ trợ trước khi kê khai.'],
 alt:'người già không có SĐT; số điện thoại người thân; khai hộ người cao tuổi'},

{id:'QA009',c:'dt',st:'note',
 q:'“Đảng viên trong trạng thái khác” nghĩa là gì?',
 a:['Thường là đảng viên đã được chuyển đi trên CSDL 4.0 nhưng TTHC chưa đồng bộ để đưa về chi bộ mới, nên tạm hiển thị ở “trạng thái khác”. Kiểm tra trên 4.0 rồi đồng bộ lại.'],
 alt:'trạng thái khác; chưa đồng bộ; chưa về chi bộ; không biết đảng viên thuộc chi bộ nào'},

{id:'QA050',c:'dt',st:'note',
 q:'Tổ chức đảng Công an, Quân sự có được đồng bộ và thực hiện các TTHC này không?',
 a:['Khối Công an/Quân sự không được đồng bộ sang CSDL 4.0 Internet và tại thời điểm đầu 10/2026 chưa triển khai trên Internet. Không thấy các tổ chức này trên Internet là đúng phạm vi, không phải lỗi thiếu dữ liệu.',
    'Không tự tạo dữ liệu trùng để “bù”. Việc thực hiện TTHC/DVC của khối này theo hướng dẫn riêng.'],
 alt:'công an; quân sự; CA; QS; không thấy chi bộ CA/QS; thống kê tính cả CA/QS'},

{id:'QA066',c:'dt',st:'note',
 q:'Trong thời gian trường/chi bộ chờ sáp nhập, thu đảng phí bằng tiền mặt hay chờ ứng dụng?',
 a:['Vẫn xử lý đảng phí theo kỳ hiện tại ở đơn vị cũ đến thời điểm sáp nhập rồi bàn giao tài chính theo quy định.',
    'Nếu tỉnh/cấp ủy có chỉ đạo riêng thì thực hiện theo chỉ đạo đó.'],
 alt:'thu tiền mặt; chờ sáp nhập; trường học; bàn giao tài chính'},

/* ===== PHÂN QUYỀN & VAI TRÒ ===== */
{id:'QA015',c:'pq',st:'ok',
 q:'Vai trò Quản trị đơn vị và Bí thư chi bộ làm những việc gì trên hệ thống?',
 a:['Quản trị đơn vị: phân quyền, cấu hình tài khoản ngân hàng.',
    'Bí thư chi bộ: đồng bộ đảng viên và xử lý nghiệp vụ (phê duyệt…).',
    'Quyền cụ thể phụ thuộc cấu hình được cấp.'],
 alt:'quản trị; bí thư; quyền nào mới thấy đồng bộ; ai thêm tài khoản ngân hàng; vai trò'},

{id:'QA056',c:'pq',st:'ok',
 q:'Một tài khoản muốn dùng được nhiều chức năng (quản trị, duyệt, ký, tài chính) thì phân vai trò thế nào?',
 a:['Mỗi vai trò có chức năng riêng: Quản trị – cấu hình/phân quyền; Bí thư – nghiệp vụ/phê duyệt; Tài chính – đảng phí; Ủy quyền – xử lý/ký; Văn thư – đóng dấu.',
    'Chỉ gán vai trò đúng thẩm quyền, không gán vượt quyền chỉ để có đủ menu.'],
 alt:'quản trị không đủ quyền; muốn full chức năng; add cả bí thư và quản trị; văn thư; ủy quyền'},

{id:'QA001',c:'pq',st:'ok',
 q:'Phân quyền người dùng mới, hệ thống báo “Tên đăng nhập đã tồn tại” nhưng trong danh sách đơn vị không thấy tài khoản?',
 a:['Vào Quản lý tài khoản đã phân quyền, tìm tài khoản và thêm quyền cho đơn vị mới.',
    'Không tìm thấy → nhờ quản trị cấp trên tra theo CCCD/tên đăng nhập, vì tài khoản có thể đã được phân ở đơn vị khác hoặc bị trùng.'],
 alt:'thêm người dùng báo tồn tại; tài khoản đã tồn tại; CCCD trùng; đổi đơn vị sau sáp nhập không phân quyền lại được'},

{id:'QA002',c:'pq',st:'note',
 q:'Đã phân quyền nhưng sau đó tài khoản/Bí thư bị mất quyền thì xử lý thế nào?',
 a:['Phân quyền lại cho tài khoản.',
    'Quyền tiếp tục tự mất → báo đầu mối hỗ trợ kiểm tra (chưa xác định nguyên nhân kỹ thuật).'],
 alt:'mất quyền; mất phân quyền; bí thư mất quyền; add tài khoản xong rồi mất quyền'},

{id:'QA074',c:'pq',st:'ok',
 q:'Vì sao không đăng nhập được khu vực quản lý/quản trị dù tài khoản cá nhân vẫn có?',
 a:['Khu vực quản lý chỉ vào được khi tài khoản đã được phân vai trò phù hợp. Kiểm tra/phân quyền lại; đừng nhầm với tài khoản cá nhân của đảng viên.'],
 alt:'không vào được trang quản trị; chưa phân quyền; tài khoản có nhưng thiếu vai trò'},

{id:'QA041',c:'pq',st:'ok',
 q:'Đăng nhập nhưng không thấy mục “Quản lý đảng viên”?',
 a:['Kiểm tra đang ở đúng vai trò/phân hệ “Quản trị hệ thống” chưa.',
    'Đúng vai trò mà vẫn thiếu → kiểm tra quyền đã cấp; quyền đúng mà menu vẫn thiếu thì báo đầu mối hỗ trợ.'],
 alt:'không có phần quản lý đảng viên; thiếu menu; thiếu chức năng sau đăng nhập'},

{id:'QA020',c:'pq',st:'note',
 q:'Đảng bộ trường học (hoặc đảng bộ có chi bộ trực thuộc) thì cấp nào phân quyền cho các chi bộ cấp dưới?',
 a:['Cấp trên chỉ cần phân quyền Quản trị đơn vị đúng cho Đảng bộ đó; Đảng bộ có quyền Quản trị đơn vị sẽ cấu hình/phân quyền cho các chi bộ trực thuộc.'],
 alt:'phân quyền cho đảng bộ trường hay từng chi bộ; ai cấu hình chi bộ con; phân quyền cấp dưới'},

{id:'QA021',c:'pq',st:'ok',
 q:'Các trường/chi bộ đang chờ sáp nhập thì có nên phân quyền ngay không?',
 a:['Nên chờ sáp nhập xong, thành lập chi bộ/trường mới rồi mới phân quyền, tránh phải làm lại theo đơn vị cũ.'],
 alt:'trường chuẩn bị nhập có cấp quyền không; phân quyền trước hay sau sáp nhập'},

{id:'QA075',c:'pq',st:'ok',
 q:'Sau sáp nhập/thay Bí thư có phải phân quyền lại cho Bí thư mới không?',
 a:['Có. Phân quyền lại cho người mới theo vai trò phù hợp.',
    'Tài khoản ngân hàng, chữ ký số liên quan cũng có thể cần cập nhật theo quyết định mới.'],
 alt:'bí thư mới thay người cũ; thay cấp ủy; cấp quyền lại'},

{id:'QA065',c:'pq',st:'open',
 q:'Sau thay Bí thư/cấp ủy hoặc sáp nhập, làm sao xóa phân quyền/vai trò cũ của người dùng?',
 a:['Phân quyền cho người mới trước. Việc gỡ quyền người cũ chưa có hướng dẫn thao tác rõ; nếu không gỡ được trên giao diện thì nhờ đầu mối hỗ trợ xử lý.'],
 alt:'xóa quyền người cũ; bỏ vai trò bí thư cũ; thu hồi quyền'},

/* ===== ĐỒNG BỘ DỮ LIỆU & SÁP NHẬP ===== */
{id:'QA019',c:'db',ref:'QA084',st:'ok',
 q:'Sau sáp nhập/chia tách, dữ liệu tổ chức và đảng viên trên TTHC chưa đúng thì làm theo thứ tự nào?',
 a:['TTHC lấy dữ liệu từ CSDL 4.0.',
    '1. Sửa đúng cơ cấu tổ chức, đảng viên trên CSDL 4.0.',
    '2. Khóa/công khai cây tổ chức trên 4.0.',
    '3. Đồng bộ lại TTHC.',
    '4.0 đã đúng mà TTHC vẫn sai/thiếu → chờ lượt đồng bộ hoặc báo đầu mối hỗ trợ.'],
 alt:'sáp nhập; đồng bộ tổ chức; đồng bộ đảng viên; 4.0 đúng nhưng TTHC sai; chi bộ mới chưa sang; khóa cây'},

{id:'QA067',c:'db',st:'note',
 q:'Đồng bộ từ 4.0 sang TTHC xong nhưng thiếu rất nhiều đảng viên?',
 a:['1. Đối chiếu tổng số và danh sách đảng viên trên CSDL 4.0.',
    '2. Tại gqtthc.dcs.vn, chạy lại đồng bộ từ CSDL 4.0 cho đơn vị (nếu tài khoản có chức năng này).',
    '3. Vẫn thiếu → ghi rõ số lượng trên 4.0 và trên TTHC, gửi đầu mối hỗ trợ.'],
 alt:'thiếu đảng viên; mất đảng viên; số lượng không đủ; đồng bộ xong mất hàng trăm đảng viên'},

{id:'QA077',c:'db',st:'note',
 q:'Đồng bộ tổ chức từ 4.0 nhưng sang TTHC thiếu một số chi/đảng bộ hoặc có đơn vị thừa?',
 a:['Đối chiếu số tổ chức trên 4.0 trước. Nếu 4.0 đúng mà TTHC vẫn thiếu/thừa thì đồng bộ lại và gửi danh sách đơn vị sai cho đầu mối hỗ trợ.'],
 alt:'thiếu tổ chức đảng; 52 chi đảng bộ chỉ đồng bộ 47; thừa chi bộ'},

{id:'QA044',c:'db',st:'ok',
 q:'Sau sáp nhập, TTHC vẫn còn chi bộ cũ hoặc xuất hiện tên chi bộ trùng?',
 a:['Sửa cơ cấu đúng trên 4.0, khóa/công khai rồi đồng bộ.',
    'TTHC vẫn còn chi bộ cũ/tên trùng → không tự xóa; báo đầu mối hỗ trợ xử lý bản ghi dư.'],
 alt:'chi bộ cũ chưa mất; trùng tên tổ chức; đơn vị cũ còn'},

{id:'QA043',c:'db',st:'ok',
 q:'Tổ chức mới đã đồng bộ nhưng Sổ tổng hợp thu, nộp đảng phí vẫn còn tên chi bộ cũ?',
 a:['Kiểm tra 4.0 đã đúng và đã khóa/công khai cây tổ chức, rồi đồng bộ lại TTHC.',
    'Sổ tổng hợp vẫn còn chi bộ cũ → báo đầu mối hỗ trợ.'],
 alt:'sổ tổng hợp; chi bộ giải thể vẫn hiện; thống kê còn tên cũ'},

{id:'QA072',c:'db',st:'note',
 q:'Sau sáp nhập thôn/chi bộ, trang quản trị vẫn còn thông tin cũ và chưa có đơn vị mới?',
 a:['Sửa cơ cấu thôn/chi bộ đúng trên 4.0 và công khai dữ liệu, rồi đồng bộ lại TTHC. Vẫn còn dữ liệu cũ → báo đầu mối hỗ trợ.'],
 alt:'thôn mới; chi bộ mới; quản trị chưa cập nhật sau sáp nhập'},

{id:'QA042',c:'db',st:'note',
 q:'Đảng viên đã kê khai nhưng tài khoản quản trị/Bí thư không thấy hồ sơ để phê duyệt?',
 a:['Trường hợp đã gặp là do dữ liệu sau sáp nhập chưa đồng bộ. Kiểm tra/chờ đồng bộ; kéo dài thì báo đầu mối hỗ trợ kiểm tra luồng hồ sơ.'],
 alt:'đảng viên khai rồi mà quản trị không có hồ sơ; hồ sơ không về để duyệt'},

{id:'QA018',c:'db',st:'open',
 q:'Đảng viên không tự kê khai được vì thiếu “Tổ chức đảng đang sinh hoạt”, Bí thư cũng không thấy danh sách để kê khai hộ?',
 a:['Chưa xác định nguyên nhân. Kiểm tra tổ chức và đảng viên trên CSDL 4.0 đã đúng, đủ chưa; nếu tài khoản có chức năng đồng bộ thì đồng bộ lại.',
    'Vẫn lỗi → gửi tên đơn vị, đảng viên cụ thể và ảnh hai màn hình cho đầu mối hỗ trợ.'],
 alt:'không thấy chi bộ để chọn; không hiện danh sách đảng viên kê khai hộ; tổ chức đảng đang sinh hoạt'},

{id:'QA028',c:'db',st:'open',
 q:'Chi bộ đông đảng viên nhưng màn kê khai hộ chỉ hiện khoảng 100 người hoặc khó tìm?',
 a:['Đây là hạn chế đã được ghi nhận, chưa có cách tự mở rộng giới hạn hay đổi thứ tự.',
    'Không tìm thấy người cần kê khai → gửi tên đơn vị và danh sách bị thiếu cho đầu mối hỗ trợ.'],
 alt:'kê khai hộ không thấy đủ người; tối đa 100; danh sách lộn xộn; chi bộ vài trăm đảng viên'},

{id:'QA081',c:'db',st:'ok',
 q:'Không xem được danh sách đầy đủ thành viên của chi bộ?',
 a:['Bí thư vào Quản lý đảng viên để xem thành viên chi bộ.',
    'Danh sách vẫn thiếu → kiểm tra quyền và trạng thái đồng bộ; 4.0 đúng mà vẫn thiếu thì báo đầu mối hỗ trợ.'],
 alt:'không xem được tất cả thành viên; danh sách đảng viên chi bộ'},

{id:'QA069',c:'db',ref:'QA094',st:'note',
 q:'Làm sao xuất danh sách toàn bộ đảng viên của Đảng ủy xã để theo dõi ai đã/chưa kích hoạt?',
 a:['Hiện chưa có chức năng xuất/lọc ổn định theo trạng thái kích hoạt. “Chưa kích hoạt” = chưa đăng nhập hệ thống.',
    'Tạm kiểm tra trong Quản lý đảng viên; cần danh sách tổng hợp thì nhờ đầu mối hỗ trợ.'],
 alt:'xuất danh sách đảng viên; theo dõi kích hoạt; chưa kích hoạt'},

{id:'QA045',c:'db',st:'note',
 q:'Đã sửa tên đảng viên trên 4.0 và gqtthc nhưng một giao diện quản trị vẫn hiện tên cũ?',
 a:['Các trang quản trị/xử lý đã gộp về gqtthc.dcs.vn — kiểm tra trên 4.0 và gqtthc trước.',
    'Hai nơi đã đúng thì không sửa ngược dữ liệu nguồn; gửi đầu mối hỗ trợ kèm CCCD, tên cũ – tên mới để kiểm tra đồng bộ.'],
 alt:'sai tên; tên cũ vẫn còn; 4.0 đúng tên nhưng quản trị sai tên'},

{id:'QA025',c:'db',st:'ok',
 q:'Sau khi xác thực/lưu đơn vị, hệ thống báo “Mã cơ quan đã tồn tại”?',
 a:['Mã đang bị trùng hoặc đã gắn với bản ghi khác. Không tự đặt mã khác để vượt lỗi.',
    'Gửi mã cơ quan, tên đơn vị và ảnh lỗi cho đầu mối hỗ trợ để tra bản ghi đang chiếm mã.'],
 alt:'mã đơn vị trùng; lưu báo tồn tại; mã cơ quan'},

/* ===== CHỮ KÝ SỐ ===== */
{id:'QA022',c:'ks',st:'ok',
 q:'Sau khi đồng bộ cơ cấu tổ chức theo Hướng dẫn 208, đơn vị nào còn phải ký số?',
 a:['Đơn vị chuyển từ “chi bộ cơ sở” về “chi bộ” thường không còn nút ký số; ký số tập trung ở cấp đảng bộ/người có thẩm quyền.',
    'Vẫn phải xem đúng loại tổ chức và luồng hồ sơ thực tế: nếu đơn vị còn bước ký trên hệ thống thì dùng chữ ký số được cấp.'],
 alt:'chi bộ có cần chữ ký số không; vì sao mất nút ký số; ký số ở cấp nào; 208'},

{id:'QA012',c:'ks',st:'ok',
 q:'Chi bộ không có con dấu/chi bộ trực thuộc có phải dùng chữ ký số trên TTHC không?',
 a:['Không kết luận tuyệt đối theo tên gọi. Nếu hệ thống không có bước ký với đơn vị thì không cần token; nếu hồ sơ của đơn vị có bước ký thì phải dùng chữ ký số phù hợp.'],
 alt:'chi bộ thôn không dấu; bí thư chi bộ có cần CKS; chi bộ trực thuộc ký thế nào'},

{id:'QA029',c:'ks',st:'note',
 q:'Chi bộ/đảng bộ có con dấu nhưng không có token, trong khi phần mềm yêu cầu ký?',
 a:['Xác định đơn vị đang là loại tổ chức nào và hồ sơ ở bước xử lý nào. Không suy từ “có con dấu” hay “là chi bộ”.',
    'Hệ thống vẫn hiện bước ký mà đơn vị chưa có chứng thư/token → kiểm tra lại loại đơn vị, quyền và liên hệ đầu mối cấp chữ ký số.'],
 alt:'có dấu nhưng không có token; phần mềm bắt token; cấu hình con dấu'},

{id:'QA047',c:'ks',st:'ok',
 q:'Đã có chữ ký số cá nhân của VNPT/Viettel thì có dùng để phê duyệt TTHC được không?',
 a:['Được. Chữ ký số cá nhân đã được cấp (VNPT, Viettel…) dùng được để phê duyệt; không bắt buộc riêng chữ ký số Ban Cơ yếu.',
    'Điều này không có nghĩa mọi Bí thư đều phải đăng ký thêm một chữ ký số cá nhân mới.'],
 alt:'VNPT Smart CA; Viettel; Ban Cơ yếu; chứng thư số; chữ ký số cá nhân'},

{id:'QA048',c:'ks',st:'ok',
 q:'Muốn đăng ký/cấp chữ ký số phục vụ TTHC thì đăng ký ở đâu, theo mẫu nào?',
 a:['Đăng ký qua cổng Cơ yếu Chính phủ (ca.gov.vn). Mẫu đăng ký tải tại dichvucong.ca.gov.vn, mục “Biểu mẫu, Phần mềm”.',
    'Chọn đúng biểu mẫu theo loại chứng thư và loại hình đơn vị.'],
 alt:'xin mẫu đăng ký chữ ký số; đăng ký CKS cho bí thư; cấp chứng thư ở đâu'},

/* ===== ĐĂNG NHẬP, GIAO DIỆN & TÀI LIỆU ===== */
{id:'QA037',c:'dn',st:'ok',
 q:'Đảng viên không đăng nhập được TTHC qua VNeID thì kiểm tra gì trước?',
 a:['Đối chiếu họ tên, CCCD và đặc biệt ngày sinh giữa CSDL 4.0 với dữ liệu dân cư/VNeID. Lệch thông tin thì sửa dữ liệu nguồn rồi đăng nhập lại.'],
 alt:'đăng nhập; VNeID; sai ngày sinh giữa 4.0 và VNeID; CCCD đúng nhưng vẫn không đăng nhập'},

{id:'QA038',c:'dn',st:'ok',
 q:'Trên app TTHC/iCPV bấm đăng nhập VNeID nhưng không chuyển sang ứng dụng VNeID (nhất là máy Oppo)?',
 a:['1. Oppo/ColorOS: Cài đặt → Ứng dụng → Quản lý ứng dụng → VNeID → Mở theo mặc định (hoặc Mở các liên kết hỗ trợ) → bật quyền mở liên kết.',
    '2. Vẫn không chuyển được → dùng bản web thay cho app.',
    '3. Web cũng lỗi → gửi ảnh lỗi, model máy/phiên bản hệ điều hành và tài khoản cho đầu mối hỗ trợ.',
    'Đây là lỗi mở liên kết ở một số máy, không phải mọi máy Oppo đều không dùng được.'],
 alt:'máy Oppo không vào được VNeID; Find X8; ColorOS; Android bấm VNeID không nhảy; deeplink'},

{id:'QA039',c:'dn',st:'ok',
 q:'Vào trang quản trị nhưng chỉ hiện màn hình trắng?',
 a:['Đường dẫn quản trị cũ không còn dùng; vào gqtthc.dcs.vn.',
    'Đúng gqtthc.dcs.vn mà vẫn trắng → tải lại/đổi trình duyệt, sau đó báo đầu mối hỗ trợ.'],
 alt:'trang quản trị trắng; không hiển thị; đường dẫn quản trị'},

{id:'QA078',c:'dn',st:'ok',
 q:'Đăng nhập bằng tài khoản cá nhân/Bí thư nhưng hệ thống hiện giao diện hoặc vai trò không đúng?',
 a:['Dùng đúng gqtthc.dcs.vn và kiểm tra tài khoản đã được phân đúng vai trò.',
    'Sai giao diện → phân quyền lại bằng tài khoản quản trị; đúng đường dẫn/quyền mà vẫn sai thì báo đầu mối hỗ trợ.'],
 alt:'đăng nhập cá nhân mà ra trang khác; sai vai trò; giao diện lạ'},

{id:'QA051',c:'dn',st:'note',
 q:'Người khác đã có giao diện/chức năng mới nhưng tài khoản mình chưa thấy?',
 a:['Tải lại trang, đăng xuất – đăng nhập lại. Vẫn khác → gửi tài khoản, vai trò và ảnh màn hình cho đầu mối hỗ trợ.',
    'Không tự đổi quyền hoặc sửa dữ liệu để cố làm menu xuất hiện.'],
 alt:'chưa có giao diện như người khác; không thấy menu mới; chưa cập nhật phiên bản'},

{id:'QA023',c:'dn',st:'open',
 q:'Vào khu vực quản trị hoặc phân quyền bị lỗi 304?',
 a:['Chưa có cách tự xử lý được xác nhận. Gửi ảnh lỗi, tài khoản và thời điểm xảy ra cho đầu mối hỗ trợ.'],
 alt:'lỗi 304; 304; không vào quản trị; phân quyền quản trị báo 304'},

{id:'QA046',c:'dn',st:'ok',
 q:'Tìm tài liệu, video hướng dẫn sử dụng TTHC ở đâu?',
 a:['Dùng thư mục “Tài liệu” trên trang theo dõi DVC Lào Cai (văn bản, video hướng dẫn). Ưu tiên tài liệu tại đây thay vì file Zalo đã hết hạn.',
    'File đính kèm trong nhóm Zalo đã hết hạn thì không lấy lại được; đề nghị người gửi hoặc đầu mối hỗ trợ gửi lại file/link mới.'],
 alt:'tài liệu hướng dẫn; video hướng dẫn; HDSD; file hết hạn; hướng dẫn hoàn tiền; tập huấn',
 ref:'QA032',link:'https://drive.google.com/drive/folders/1_qh0ruwMpYI15BlIwaXmOyFk3q24TMIa'},

/* ===== BỔ SUNG 19/10/2026 – CHUYỂN SINH HOẠT & NHẬN XÉT NƠI CƯ TRÚ ===== */
{id:'QA112',c:'tt',st:'ok',
 q:'Chuyển sinh hoạt Đảng chính thức cần chuẩn bị và thao tác gì?',
 a:['1. Chọn cơ quan tiếp nhận.',
    '2. Khai thông tin và lý do chuyển.',
    '3. Đính kèm Bản tự kiểm điểm có nhận xét của chi bộ (bắt buộc, dung lượng dưới 20MB).',
    '4. Xem lại hồ sơ, cam kết và nộp.',
    'Trước khi chuyển cần thực hiện nghĩa vụ đảng phí theo quy định.'],
 alt:'chuyển đơn vị sinh hoạt; chuyển từ chi bộ này sang chi bộ khác; chuyển sang đảng bộ khác; bản tự kiểm điểm; nhận xét chi bộ; 20MB'},

{id:'QA113',c:'tt',st:'ok',
 q:'Chuyển sinh hoạt Đảng tạm thời cần nhập và đính kèm gì?',
 a:['1. Chọn cơ quan tiếp nhận.',
    '2. Khai lý do và thời gian chuyển “từ ngày … đến ngày …” (bắt buộc).',
    '3. Đính kèm Bản tự kiểm điểm có nhận xét của chi bộ (dưới 20MB).',
    '4. Xem lại hồ sơ, cam kết và nộp.',
    'Về đảng phí và quân số trong thời gian sinh hoạt tạm thời, xem các mục cùng nhóm.'],
 alt:'chuyển sinh hoạt tạm thời; từ ngày đến ngày; bản tự kiểm điểm; nhận xét chi bộ; thời hạn tạm thời'},

{id:'QA114',c:'tt',st:'ok',
 q:'Thủ tục lấy ý kiến nhận xét nơi cư trú có những lựa chọn nội dung nào?',
 a:['Chọn thủ tục và cơ quan tiếp nhận. Ở mục Nội dung chọn một trong hai:',
    '1. Lập giấy giới thiệu đảng viên sinh hoạt nơi cư trú; hoặc',
    '2. Lập phiếu xin ý kiến nhận xét của chi ủy/chi bộ nơi cư trú.',
    'Sau đó khai theo biểu mẫu → xem lại → nộp.'],
 alt:'nơi cư trú; giấy giới thiệu; phiếu xin ý kiến; lấy ý kiến nơi cư trú năm 2026; nhận xét chi bộ'},

{id:'QA101',c:'tt',st:'note',
 q:'Luồng xử lý điện tử thủ tục nhận xét nơi cư trú (213) đi qua những bước nào?',
 a:['Bên gửi: nộp hồ sơ → chi bộ duyệt → đảng ủy ký → văn thư đóng dấu/chuyển đi.',
    'Bên nhận: tiếp nhận/tạo phiếu → đảng ủy ký → văn thư đóng dấu → hoàn tất.',
    'Luồng này lấy từ trao đổi thực tế; cần đối chiếu với phiên bản hệ thống hiện hành.'],
 alt:'213; nhận xét nơi cư trú; chi bộ duyệt; đảng ủy ký; văn thư đóng dấu; phiếu nhận'},

{id:'QA103',c:'tt',st:'note',
 q:'Muốn biết ai chưa cập nhật thông tin tổ chức đảng nơi cư trú thì kiểm tra thế nào?',
 a:['Chưa có báo cáo tổng hợp tự động.',
    'Cách được hướng dẫn: Bí thư xem danh sách Quản lý đảng viên — người đã cập nhật thì cột “Tổ chức đảng nơi cư trú” có thông tin; chưa có thông tin thì coi là chưa cập nhật.'],
 alt:'nơi cư trú; chưa cập nhật; quản lý đảng viên; tổ chức đảng nơi cư trú; thống kê'},

{id:'QA115',c:'tt',st:'ok',
 q:'Cán bộ xử lý hồ sơ TTHC thế nào khi hồ sơ thiếu, không đạt hoặc đạt?',
 a:['Thiếu → chọn Yêu cầu bổ sung và ghi rõ cần bổ sung gì.',
    'Không đạt → chọn Từ chối xử lý và ghi lý do.',
    'Đạt → Phê duyệt, hoàn thiện phiếu/văn bản; đơn vị có con dấu thì ký số theo quy trình trước khi hoàn tất.'],
 alt:'yêu cầu bổ sung; từ chối xử lý; phê duyệt; ký số; xử lý hồ sơ chuyển sinh hoạt; nhận xét nơi cư trú'},

{id:'QA116',c:'tt',st:'ok',
 q:'Trước và sau khi nộp hồ sơ TTHC nên kiểm tra gì để tránh phải bổ sung lại?',
 a:['Trước khi bấm Nộp, kiểm tra: cơ quan tiếp nhận, người đề nghị, tờ khai và tệp đính kèm.',
    'Sau khi nộp, vào Hồ sơ của tôi/Tra cứu hồ sơ để theo dõi trạng thái, yêu cầu bổ sung và kết quả xử lý.'],
 alt:'trước khi nộp; cơ quan tiếp nhận; người đề nghị; tờ khai; tệp đính kèm; tra cứu hồ sơ'},

{id:'QA091',c:'tt',st:'ok',
 q:'Muốn biết một hồ sơ TTHC đang nằm ở bước nào thì xem ở đâu?',
 a:['Dùng chức năng Tra cứu hồ sơ; tại đây thấy hồ sơ đang ở bước/đơn vị nào trong luồng xử lý.'],
 alt:'tra cứu hồ sơ; hồ sơ đang ở đâu; trạng thái hồ sơ; tiến độ xử lý'},

/* ===== BỔ SUNG 19/10/2026 – CÁC NỘI DUNG KHÁC ===== */
{id:'QA105',c:'dp',st:'note',
 q:'Khi nào bắt đầu thu, nộp đảng phí qua DVC/TTHC?',
 a:['Triển khai thực tế thu/nộp đảng phí qua DVC/TTHC từ tháng 10/2026. Mốc tháng 9 chỉ là dự kiến cũ.',
    'Kê khai/phê duyệt hồ sơ lần đầu thực hiện trong tháng 9/2026; từ tháng 10, hồ sơ định kỳ được hệ thống tự sinh sau khi dữ liệu BHXH được chốt.'],
 alt:'thời điểm triển khai; bắt đầu nộp đảng phí; mở cổng; tháng 9; tháng 10; lúc nào nộp'},

{id:'QA108',c:'dp',st:'note',
 q:'Đảng phí trực tuyến trong tháng phải nộp trước ngày 15 hay nộp đến hết tháng?',
 a:['Theo hướng dẫn 2026, hệ thống cho nộp trong cả tháng. Mốc ngày 15 mới là dự thảo/mốc tính chậm, chưa phải hạn khóa nộp.',
    'Nếu có quy định mới thì ưu tiên văn bản mới.'],
 alt:'thời hạn nộp; ngày 1 đến 30; ngày 15; chậm nộp'},

{id:'QA109',c:'dp',st:'note',
 q:'Số tiền đảng phí có phần lẻ thì làm tròn lên hay xuống?',
 a:['Theo hướng dẫn trong nhóm: phần lẻ từ 1 đến 499 đồng làm tròn xuống; từ 500 đồng trở lên làm tròn lên.'],
 alt:'làm tròn tiền; 500 đồng; làm tròn lên; làm tròn xuống; số lẻ'},

{id:'QA106',c:'dp',st:'ok',
 q:'Người thuộc diện BHXH bắt buộc thì mức 1% đảng phí tính trên khoản nào? Phụ cấp có nhân 1% riêng không?',
 a:['1% tính trên mức tiền lương làm căn cứ đóng BHXH bắt buộc, không nhân riêng từng khoản phụ cấp.',
    'Dữ liệu BHXH sai thì điều chỉnh số tiền theo thực tế trước khi duyệt.'],
 alt:'1%; phụ cấp; mức đóng BHXH bắt buộc; tiền lương BHXH'},

{id:'QA086',c:'dp',st:'note',
 q:'Đảng viên hưởng lương hưu nhưng hệ thống tính mức đảng phí theo 1% có phải lỗi không?',
 a:['Phía hỗ trợ cho biết API BHXH đang trả dư cả một số người hưởng lương hưu và đang chờ điều chỉnh.',
    'Nhóm hưu trí dùng mức lương hưu được hưởng hàng tháng làm căn cứ; khi hệ thống tính sai thì điều chỉnh số tiền theo thực tế trước khi duyệt.'],
 alt:'lương hưu; hưu trí; 1%; BHXH; mức đảng phí; API'},

{id:'QA087',c:'dp',st:'ok',
 q:'Muốn cấu hình trường hợp miễn/giảm đảng phí thì vào đâu?',
 a:['Vào Quản lý đảng viên → Cập nhật tình trạng đảng viên, phần cấu hình đảng phí để chọn mức miễn/giảm phù hợp rồi cập nhật.',
    'Nên cập nhật tình trạng trước khi lập hồ sơ đảng phí.'],
 alt:'cập nhật tình trạng; miễn giảm; cấu hình đảng phí; 50%; miễn sinh hoạt'},

{id:'QA104',c:'dp',st:'ok',
 q:'Hồ sơ đảng phí kê khai sai thông tin/số tiền thì có những cách nào để sửa?',
 a:['Có hai cách, tùy trạng thái hồ sơ và quyền đang có:',
    '1. Bí thư từ chối phê duyệt để người kê khai tự khai lại; hoặc',
    '2. Bí thư điều chỉnh hộ thông tin/số tiền trên hồ sơ.'],
 alt:'sai hồ sơ; sai số tiền; từ chối phê duyệt; khai lại; bí thư điều chỉnh hộ'},

{id:'QA093',c:'dp',st:'ok',
 q:'Muốn xuất danh sách người chưa khai báo/nộp đảng phí theo đảng bộ hoặc từng chi bộ thì làm thế nào?',
 a:['Vào Theo dõi thu nộp đảng phí → Xem chi tiết → chọn tổ chức → lọc theo trạng thái.',
    'Ở phạm vi đảng bộ có thể xuất toàn đảng bộ; cần chi bộ nào thì chọn chi bộ đó rồi xuất.'],
 alt:'chưa khai báo đảng phí; chưa nộp; xuất danh sách; theo dõi đảng phí; lọc theo chi bộ'},

{id:'QA089',c:'pb',st:'ok',
 q:'Đã thêm tài khoản ngân hàng nhưng tình trạng xác nhận dữ liệu phân bổ vẫn ghi “Chưa xác nhận” thì làm gì?',
 a:['Vào chức năng Xác nhận dữ liệu phân bổ, kiểm tra tỷ lệ giữ lại/nộp lên và xác nhận theo đơn vị.',
    'Việc nhận phân bổ còn phụ thuộc tài khoản ngân hàng đã được khai báo/xác thực đầy đủ.'],
 alt:'chưa xác nhận; xác nhận dữ liệu phân bổ; tỷ lệ giữ lại; tỷ lệ nộp lên'},

{id:'QA090',c:'pb',st:'ok',
 q:'Sau khi đơn vị đổi loại hình có phải xác nhận lại tỷ lệ phân bổ không?',
 a:['Tỷ lệ phân bổ phụ thuộc loại hình tổ chức. Sau khi đổi loại hình:',
    '1. Sửa đúng dữ liệu nguồn trên CSDL 4.0.',
    '2. Đồng bộ lại.',
    '3. Kiểm tra tỷ lệ, chỉ xác nhận khi đúng.',
    'Vẫn giữ tỷ lệ cũ → báo đầu mối hỗ trợ.'],
 alt:'đổi loại hình; xác nhận lại; tỷ lệ phân bổ; phân loại đơn vị'},

{id:'QA099',c:'pb',st:'note',
 q:'Một tài khoản ngân hàng có dùng chung cho nhiều tổ chức đảng được không? Đơn vị chưa có tài khoản tổ chức thì sao?',
 a:['Không dùng chung. Hiện mỗi tài khoản ngân hàng chỉ được cấu hình cho một tổ chức đảng.',
    'Đơn vị chưa có tài khoản của tổ chức: tại thời điểm trao đổi, hệ thống vẫn cho cấu hình tài khoản cá nhân, nhưng phải bảo đảm đúng quy định tài chính và hướng dẫn của đơn vị.'],
 alt:'dùng chung tài khoản ngân hàng; một tài khoản một đơn vị; tài khoản cá nhân; tổ chức chưa có tài khoản'},

{id:'QA102',c:'pb',st:'ok',
 q:'Ngân hàng chưa có trong danh sách khi khai báo tài khoản thì thêm ở đâu?',
 a:['Danh sách ngân hàng do cổng thanh toán của Dịch vụ công quốc gia quản lý. Muốn bổ sung phải được tích hợp với cổng quốc gia, phần mềm TTHC không tự thêm trực tiếp được.'],
 alt:'ngân hàng không có trong danh sách; cổng thanh toán; DVCQG; tích hợp ngân hàng'},

{id:'QA088',c:'pq',st:'ok',
 q:'Tài khoản không thấy chức năng Đồng bộ dữ liệu từ 4.0 hoặc Cập nhật tình trạng đảng viên thì vì sao?',
 a:['Các chức năng này phụ thuộc vai trò. Kiểm tra tài khoản đã có đúng quyền Bí thư/Quản trị; thiếu thì phân quyền lại.',
    'Quyền đúng mà vẫn không có thì báo đầu mối hỗ trợ.'],
 alt:'không có đồng bộ 4.0; không có cập nhật tình trạng; thiếu chức năng; quyền'},

{id:'QA097',c:'pq',st:'ok',
 q:'Đang là quản trị của một đơn vị, muốn thêm vai trò quản trị cho đơn vị khác thì làm thế nào?',
 a:['Vào Quản lý tài khoản và khai báo thêm một quyền mới cho đơn vị mới. Không cần tạo tài khoản mới chỉ để có thêm vai trò ở đơn vị khác.'],
 alt:'đổi vai trò; quản trị tỉnh; quản trị chi bộ; thêm quyền; quản lý tài khoản'},

{id:'QA095',c:'db',st:'ok',
 q:'Vì sao CSDL 4.0 có đảng viên nhưng danh sách trên TTHC chưa hiện đủ?',
 a:['Thiếu danh sách có thể do đảng viên chưa đăng nhập lần nào hoặc do chưa đồng bộ.',
    'Kiểm tra trạng thái đăng nhập trước; đã đăng nhập mà vẫn thiếu thì kiểm tra đồng bộ.'],
 alt:'danh sách đảng viên; chưa hiện; chưa đăng nhập; dữ liệu 4.0'},

{id:'QA107',c:'db',st:'ok',
 q:'Có cần cập nhật mã định danh tổ chức đảng trên TTHC để liên thông văn bản không?',
 a:['Có. Muốn liên thông Hệ điều hành tác nghiệp, mã định danh tổ chức đảng trên TTHC phải trùng mã gửi/nhận văn bản đang dùng. Thiếu hoặc sai mã thì cập nhật trước khi triển khai.'],
 alt:'mã định danh tổ chức đảng; mã gửi nhận văn bản; HĐTN; liên thông văn bản; cấp xã'},

{id:'QA098',c:'dn',st:'ok',
 q:'Hiện còn phải vào riêng trang quantri-gqtthc và gqtthc không?',
 a:['Không. Từ 22/05/2026, hai trang quản trị và xử lý TTHC đã gộp về một địa chỉ gqtthc.dcs.vn. Khi đăng nhập, hệ thống tự chuyển tới phân hệ phù hợp theo vai trò.'],
 alt:'quantri-gqtthc; gqtthc; gộp trang; một link; menu theo vai trò'},

{id:'QA100',c:'dn',st:'ok',
 q:'Dashboard đang thấy có phải số liệu tổng hợp toàn tỉnh không? Xem tổng hợp ở đâu?',
 a:['Dashboard có thể chỉ là hồ sơ mà người dùng đó xử lý, không phải báo cáo tổng hợp.',
    'Tổng hợp 3 TTHC nằm ở khu Báo cáo thống kê; riêng thu nộp đảng phí xem tại Theo dõi thu nộp đảng phí.'],
 alt:'dashboard; báo cáo thống kê; tổng hợp 3 TTHC; theo dõi thu nộp đảng phí; toàn tỉnh'},

{id:'QA096',c:'dn',st:'note',
 q:'Đăng nhập bỗng báo “không thuộc đối tượng” và tìm đảng viên không ra dữ liệu thì do đâu?',
 a:['Nếu nhiều người cùng báo lỗi này và tìm đảng viên không ra, có thể API CSDL 4.0 đang lỗi. Chờ thông báo kỹ thuật/khôi phục, không sửa từng tài khoản.'],
 alt:'API 4.0; không thuộc đối tượng; tìm kiếm không ra; đăng nhập lỗi'},

{id:'QA117',c:'ks',st:'open',
 q:'Tổ chức cơ sở đảng thuộc doanh nghiệp tư nhân chưa đăng ký được chứng thư số tổ chức thì xử lý thế nào?',
 a:['Chưa có quy trình chính thức. Đây là vướng mắc đã được nêu, đang chờ hướng dẫn của cơ quan Trung ương/Ban Cơ yếu; chưa nên coi ý kiến “tự đăng ký với Cục” là hướng dẫn bắt buộc.',
    'Liên hệ đầu mối Cơ yếu hoặc đầu mối hỗ trợ để có hướng dẫn hiện hành đúng loại tổ chức.'],
 alt:'doanh nghiệp tư nhân; chứng thư số tổ chức; Ban Cơ yếu; chưa đăng ký được; chữ ký số'},

/* ===== BỔ SUNG TỪ TAB "HỎI ĐÁP CÁ NHÂN" (câu hỏi thực tế của cán bộ) ===== */
{id:'CN03',c:'dp',st:'note',
 q:'Đảng viên chưa kê khai, đến khi vào nộp thì hệ thống báo “không nợ đảng phí” thì xử lý thế nào?',
 a:['Phải tạo hồ sơ đảng phí đúng kỳ trước: đảng viên tự kê khai → người có quyền phê duyệt → hồ sơ sang “Chờ nộp” → lúc đó mới thanh toán được.',
    'Hồ sơ đã ở “Chờ nộp” mà vẫn báo “không nợ đảng phí” → chụp trạng thái, ghi mã hồ sơ và gửi đầu mối hỗ trợ kiểm tra.'],
 alt:'không nợ đảng phí; chưa kê khai; hệ thống báo không nợ; nộp tiền báo lỗi'},

{id:'CN08',c:'dp',st:'open',
 q:'Đảng ủy từ chối phê duyệt hồ sơ cập nhật, hồ sơ quay về đảng viên nhưng đảng viên không vào chỉnh sửa và gửi phê duyệt lại được?',
 a:['Chưa có hướng dẫn xử lý được xác nhận cho trường hợp này. Gửi đầu mối hỗ trợ mã hồ sơ, tên đảng viên, đơn vị và ảnh màn hình.'],
 alt:'từ chối phê duyệt; không chỉnh sửa được; gửi phê duyệt lại; hồ sơ quay về đảng viên'},

{id:'CN09',c:'dp',st:'open',
 q:'Đảng viên của chi bộ nộp nhầm đảng phí vào tài khoản của đảng bộ thì tháng đó có được tính là đã nộp không?',
 a:['Chưa có hướng dẫn xác nhận. Khoản chuyển thẳng vào tài khoản ngoài luồng TTHC không được tính là hồ sơ nộp trên hệ thống (xem mục về chuyển tiền trực tiếp vào tài khoản chi bộ).',
    'Trường hợp cụ thể: liên hệ đầu mối hỗ trợ trước khi hoàn tiền hoặc yêu cầu nộp lại.'],
 alt:'nộp nhầm tài khoản; nộp vào tài khoản đảng bộ; có tính đã nộp không; chuyển nhầm',
 ref:'QA024'},

{id:'CN15',c:'dp',st:'open',
 q:'Đảng viên đã nộp thành công đảng phí nhưng hệ thống của đảng bộ và chi bộ vẫn báo trong danh sách chưa nộp?',
 a:['Chưa có nguyên nhân/cách xử lý được xác nhận. Kiểm tra hồ sơ đã ở trạng thái “Hoàn thành/Đã nộp” chưa.',
    'Đã hoàn thành mà vẫn nằm trong danh sách chưa nộp → gửi đầu mối hỗ trợ mã hồ sơ, tên đảng viên, kỳ nộp và ảnh hai màn hình.'],
 alt:'nộp rồi vẫn báo chưa nộp; danh sách chưa nộp; theo dõi đảng phí sai; đã nộp nhưng chưa ghi nhận'},

{id:'CN13',c:'tt',st:'open',
 q:'Bao giờ phải nộp bản lấy ý kiến nơi cư trú năm 2026?',
 a:['Chưa có mốc thời gian được xác nhận trong kho hỏi – đáp. Theo dõi văn bản/chỉ đạo của cấp ủy cấp trên hoặc liên hệ đầu mối hỗ trợ.'],
 alt:'thời hạn lấy ý kiến nơi cư trú; năm 2026; khi nào nộp nhận xét nơi cư trú; hạn nộp'},

/* ===== BỔ SUNG 20/10/2026 ===== */
{id:'CN05',c:'dn',st:'note',
 q:'Không nhận được mã OTP khi đăng nhập/kích hoạt tài khoản thì làm thế nào?',
 a:['1. Kiểm tra lại số điện thoại đã đăng ký có đúng không; máy có sóng và nhận được tin nhắn SMS.',
    '2. Khởi động lại điện thoại rồi bấm gửi lại OTP.',
    '3. Xem mục tin nhắn rác/spam, tìm tin nhắn từ đầu số DVC_CQDang.',
    '4. Vẫn không nhận được → kiểm tra với nhà mạng xem có chặn tin nhắn quảng cáo/thương hiệu không, hoặc gửi đầu mối hỗ trợ kèm số điện thoại và thời điểm gửi.'],
 alt:'không nhận được OTP; không có mã xác thực; SMS không về; mã OTP; DVC_CQDang; tin nhắn rác'},

{id:'QA084',c:'db',st:'ok',
 q:'Dữ liệu tổ chức/đảng viên trên TTHC bị sai thì có sửa trực tiếp trên TTHC được không?',
 a:['Không. Dữ liệu tổ chức, đảng viên trên TTHC lấy từ CSDL 4.0.',
    '1. Sửa đúng dữ liệu trên CSDL 4.0.',
    '2. Đồng bộ lại sang TTHC.',
    '3. Kiểm tra lại trên TTHC. Dữ liệu 4.0 đã đúng mà TTHC vẫn chưa cập nhật → gửi đầu mối hỗ trợ kèm tên đơn vị/đảng viên và ảnh màn hình.'],
 alt:'sửa dữ liệu trên TTHC; dữ liệu sai; cơ cấu tổ chức sai; TTHC chưa cập nhật theo 4.0; sửa ở đâu; nguồn dữ liệu'}
];
