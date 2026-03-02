/** Tên cột kết quả → tiếng Việt */
export const columnLabels: Record<string, string> = {
  // Tổng hợp tài khoản
  total_credit: "Tổng thu",
  total_debit: "Tổng chi",
  net_amount: "Số tiền ròng",
  num_transactions: "Số giao dịch",

  // Số dư
  balance: "Số dư",

  // Dòng tiền
  period: "Kỳ",
  net_flow: "Dòng tiền ròng",
  trans_count: "Số giao dịch",

  // Vùng miền
  region: "Vùng/Miền",
  district_name: "Quận/Huyện",

  // Khoản vay
  loan_count: "Số khoản vay",
  total_amount: "Tổng số tiền",
  avg_amount: "TB số tiền",
  status: "Trạng thái",
  avg_payments: "TB thanh toán",
  avg_duration: "TB thời hạn (tháng)",

  // Lệnh chi
  category: "Danh mục",
  order_count: "Số lệnh chi",

  // Giao dịch
  trans_type: "Loại giao dịch",
  operation: "Loại thao tác",

  // Cột bảng chung
  account_id: "Mã tài khoản",
  district_id: "Mã quận/huyện",
  create_date: "Ngày tạo",
  frequency: "Tần suất",
  card_id: "Mã thẻ",
  disp_id: "Mã quyền",
  card_type: "Loại thẻ",
  issued_date: "Ngày phát hành",
  client_id: "Mã khách hàng",
  birth_date: "Ngày sinh",
  gender: "Giới tính",
  disp_type: "Loại quyền",
  num_inhabitants: "Dân số",
  num_municipalities_gt499: "Số xã >499 dân",
  num_municipalities_500to1999: "Số xã 500–1999 dân",
  num_municipalities_2000to9999: "Số xã 2000–9999 dân",
  num_municipalities_gt10000: "Số xã >10000 dân",
  num_cities: "Số thành phố",
  ratio_urban: "Tỉ lệ đô thị (%)",
  average_salary: "Lương trung bình",
  unemployment_rate95: "Tỉ lệ thất nghiệp '95",
  unemployment_rate96: "Tỉ lệ thất nghiệp '96",
  num_entrep_per1000: "Số DN/1000 dân",
  num_crimes95: "Số vụ phạm tội '95",
  num_crimes96: "Số vụ phạm tội '96",
  loan_id: "Mã khoản vay",
  granted_date: "Ngày cấp",
  amount: "Số tiền",
  duration: "Thời hạn",
  payments: "Số tiền thanh toán",
  order_id: "Mã lệnh chi",
  bank_to: "Ngân hàng đích",
  account_to: "Tài khoản đích",
  trans_id: "Mã giao dịch",
  trans_date: "Ngày giao dịch",
  other_bank_id: "Mã NH khác",
  other_account_id: "Mã TK khác",

  // fn_balance_as_of trả scalar
  fn_balance_as_of: "Số dư",
  coalesce: "Số dư",
};

/** Tên tham số → tiếng Việt */
export const paramLabels: Record<string, string> = {
  p_account_id: "Mã tài khoản",
  p_date_from: "Từ ngày",
  p_date_to: "Đến ngày",
  p_as_of_date: "Tính đến ngày",
  p_period: "Kỳ báo cáo",
  p_top_n: "Số lượng hiển thị",
  p_trans_id: "Mã giao dịch",
  p_trans_date: "Ngày giao dịch",
  p_amount: "Số tiền",
  p_trans_type: "Loại giao dịch (C/D)",
  p_operation: "Loại thao tác",
  p_category: "Danh mục",
  p_other_bank_id: "Mã ngân hàng khác",
  p_other_account_id: "Mã tài khoản khác",
  p_debit_trans_id: "Mã GD ghi nợ",
  p_credit_trans_id: "Mã GD ghi có",
  p_from_account_id: "Tài khoản nguồn",
  p_to_account_id: "Tài khoản đích",
};

/** Tên hàm → mô tả tiếng Việt */
export const functionDescriptions: Record<
  string,
  { title: string; description: string; returnDesc: string }
> = {
  fn_account_summary: {
    title: "Tổng hợp tài khoản",
    description: "Thống kê tổng thu, tổng chi, số dư ròng và số giao dịch của một tài khoản trong khoảng thời gian",
    returnDesc: "Bảng tổng hợp thu chi",
  },
  fn_balance_as_of: {
    title: "Số dư tại thời điểm",
    description: "Tra cứu số dư tài khoản tính đến một ngày cụ thể",
    returnDesc: "Giá trị số dư",
  },
  fn_cashflow_report: {
    title: "Báo cáo dòng tiền",
    description: "Thống kê dòng tiền thu chi theo kỳ (tháng, quý, năm)",
    returnDesc: "Bảng dòng tiền theo kỳ",
  },
  fn_loan_stats_by_region: {
    title: "Thống kê vay theo vùng",
    description: "Thống kê số lượng và giá trị khoản vay theo vùng miền, xếp hạng top N",
    returnDesc: "Bảng thống kê khoản vay theo vùng",
  },
  fn_loan_stats_by_status: {
    title: "Thống kê vay theo trạng thái",
    description: "Phân tích khoản vay theo trạng thái (A/B/C/D)",
    returnDesc: "Bảng thống kê theo trạng thái",
  },
  fn_order_stats_by_category: {
    title: "Thống kê lệnh chi theo danh mục",
    description: "Tổng hợp số lượng và giá trị lệnh chi thường xuyên theo danh mục",
    returnDesc: "Bảng thống kê lệnh chi",
  },
  fn_trans_stats_by_type_operation: {
    title: "Thống kê GD theo loại & thao tác",
    description: "Phân tích giao dịch theo loại (thu/chi) và thao tác, có thể lọc theo ngày",
    returnDesc: "Bảng thống kê giao dịch",
  },
};

/** Tên thủ tục → mô tả tiếng Việt */
export const procedureDescriptions: Record<
  string,
  { title: string; description: string }
> = {
  sp_add_transaction: {
    title: "Thêm giao dịch",
    description: "Tạo một giao dịch mới, tự động tính số dư và kiểm tra đủ tiền khi ghi nợ",
  },
  sp_transfer_money: {
    title: "Chuyển tiền",
    description: "Chuyển tiền giữa hai tài khoản — tự động tạo giao dịch ghi nợ và ghi có",
  },
};

/** Tên bảng → tiếng Việt */
export const tableLabels: Record<string, string> = {
  fin_account: "Tài khoản",
  fin_card: "Thẻ",
  fin_client: "Khách hàng",
  fin_disp: "Quyền truy cập",
  fin_district: "Quận/Huyện",
  fin_loan: "Khoản vay",
  fin_order: "Lệnh chi",
  fin_trans: "Giao dịch",
};

export function getColumnLabel(name: string): string {
  return columnLabels[name] ?? name;
}

export function getParamLabel(name: string): string {
  return paramLabels[name] ?? name;
}
