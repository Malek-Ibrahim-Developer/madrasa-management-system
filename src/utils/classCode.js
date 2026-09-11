/**
 * Smart class code generation utility for standard canonical prefix formatting
 * Example: Class 8 + A -> CLS-08-A
 */
export const generateClassCode = (name, section = '') => {
  const normalizedName = String(name || '').trim().toUpperCase();
  const normalizedSection = String(section || '').trim().toUpperCase();

  const numberMatch = normalizedName.match(/\d+/);
  const classNumber = numberMatch ? numberMatch[0].padStart(2, '0') : '';
  const namePrefix = normalizedName.replace(/[^A-Z]/g, '').slice(0, 4);

  if (classNumber && normalizedSection) {
    return `CLS-${classNumber}-${normalizedSection.replace(/[^A-Z0-9]/g, '').slice(0, 5)}`;
  }

  if (classNumber) {
    return `CLS-${classNumber}`;
  }

  if (namePrefix) {
    return `CLS-${namePrefix}${normalizedSection ? `-${normalizedSection.slice(0, 5)}` : ''}`;
  }

  return '';
};
