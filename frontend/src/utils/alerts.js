import Swal from 'sweetalert2';

const darkTheme = {
  background: '#0f172a',
  color: '#e2e8f0',
  confirmButtonColor: '#3b82f6',
  cancelButtonColor: '#334155',
};

const iconColors = {
  error: '#ef4444',
  success: '#22c55e',
  info: '#3b82f6',
  warning: '#f59e0b',
  question: '#3b82f6',
};

export const showAlert = (title, icon = 'info', text = '') =>
  Swal.fire({
    title,
    text,
    icon,
    timer: icon === 'success' ? 1800 : icon === 'info' ? 900 : undefined,
    timerProgressBar: icon === 'success',
    showConfirmButton: icon !== 'success',
    ...darkTheme,
    ...(iconColors[icon] ? { iconColor: iconColors[icon] } : {}),
  });

export const showError = (message, title = 'Something went wrong') =>
  showAlert(title, 'error', message);

export const showConfirm = async ({
  title,
  text,
  confirmText = 'Yes, continue',
  cancelText = 'Cancel',
  danger = false,
}) => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? '#ef4444' : '#3b82f6',
    ...darkTheme,
    iconColor: '#f59e0b',
  });
  return result.isConfirmed;
};

export const showActionDone = (message = 'Saved!') =>
  Swal.fire({
    title: message,
    icon: 'success',
    timer: 1500,
    showConfirmButton: false,
    ...darkTheme,
    iconColor: iconColors.success,
  });

export default Swal;
export { Swal };