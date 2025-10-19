const indianMobileRegex = /^[6-9]\d{9}$/;

export const validateIndianMobile = (phone: string) => {
  const cleanedPhone = phone.replace(/^(\+91|0)/, '').trim();

  if (!indianMobileRegex.test(cleanedPhone)) {
    throw new Error("Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9");
  }

  return cleanedPhone;
};