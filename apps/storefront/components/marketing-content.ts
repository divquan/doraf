export const checkerProducts = [
  {
    name: "BECE Checker",
    eyebrow: "BECE",
    description: "For BECE School and BECE Private results.",
    covers: ["BECE School", "BECE Private", "All examination years"],
  },
  {
    name: "WASSCE Checker",
    eyebrow: "WASSCE",
    description: "For WASSCE School results across examination years.",
    covers: ["WASSCE School", "All examination years", "Digital delivery"],
  },
  {
    name: "NOV/DEC Checker",
    eyebrow: "PRIVATE",
    description: "For WASSCE Private, ABCE, and GBCE results.",
    covers: ["WASSCE Private", "ABCE and GBCE", "All examination years"],
  },
] as const

export const faqItems = [
  {
    category: "Buying",
    question: "How do I buy a checker?",
    answer:
      "Open a Dashchecker agent's storefront link, choose the checker you need, enter your delivery details, and continue to the secure Paystack checkout. You can pay with Mobile Money and receive the serial and PIN by SMS after successful payment.",
  },
  {
    category: "Buying",
    question: "Can the delivery number be different from the payer's number?",
    answer:
      "Yes. Dashchecker lets the person paying and the person receiving the checker use different phone numbers. Review both numbers carefully before confirming your order.",
  },
  {
    category: "Buying",
    question: "Which checker should I choose?",
    answer:
      "Choose BECE for BECE School or Private results, WASSCE for WASSCE School results, and NOV/DEC for WASSCE Private, ABCE, or GBCE results. Check the product scope before paying.",
  },
  {
    category: "Buying",
    question: "I paid but did not receive my PIN. What should I do?",
    answer:
      "Keep your order reference and the delivery phone number nearby, then use the Recover a purchase link. Dashchecker can use those details to help you access a completed purchase.",
  },
  {
    category: "Selling",
    question: "Who can become a Dashchecker agent?",
    answer:
      "Individuals in Ghana can register with their name and phone number. You do not need to buy or upload inventory; Dashchecker supplies the checkers and gives you a personalized sales link.",
  },
  {
    category: "Selling",
    question: "How do agents earn?",
    answer:
      "You choose a retail price within Dashchecker's allowed range. Your profit is the difference between your retail price and the effective platform base price. Share your storefront link to start receiving attributed sales.",
  },
  {
    category: "Selling",
    question: "How do agents receive their earnings?",
    answer:
      "Successful sales credit your withdrawable Dashchecker wallet. When you request a payout, Dashchecker verifies the request with a fresh SMS OTP and sends the approved amount to your registered Mobile Money number.",
  },
  {
    category: "Selling",
    question: "Do I need to create a password?",
    answer:
      "No. Agent sign-in uses your registered phone number and a one-time password sent by SMS.",
  },
] as const
