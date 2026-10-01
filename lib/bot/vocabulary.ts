export const botVocabulary = {
  intents: {
    CHECK_QUANTITY: ["còn", "bao nhiêu", "mấy cái", "tồn", "số lượng", "còn hàng không", "mấy đôi"],
    CHECK_LOCATION: ["ở đâu", "kệ nào", "vị trí", "chỗ nào", "đặt ở đâu", "nằm ở đâu"],
    GREETING: ["chào", "hello", "hi", "bot ơi", "q ơi", "alo"],
  },
  responses: {
    GREETING: ["Chào bạn! Mình là Q-Dcom Bot. Bạn cần tra cứu mã hàng hay vị trí kho nào?", "Q-Dcom nghe đây! Nhập mã ID hoặc tên sản phẩm để mình tìm cho nhé."],
    NOT_FOUND: ["Rất tiếc, mình chưa tìm thấy mẫu hàng khớp với từ khóa này.", "Chưa thấy mã này trong kho. Bạn thử kiểm tra lại ID hoặc tên sản phẩm nhé."],
  },
} as const;

export type BotVocabulary = {
  intents: { CHECK_QUANTITY: string[]; CHECK_LOCATION: string[]; GREETING: string[] };
  responses: { GREETING: string[]; NOT_FOUND: string[] };
};
export type BotIntent = keyof BotVocabulary["intents"] | "SEARCH";

export function copyDefaultVocabulary(): BotVocabulary {
  return {
    intents: {
      CHECK_QUANTITY: [...botVocabulary.intents.CHECK_QUANTITY],
      CHECK_LOCATION: [...botVocabulary.intents.CHECK_LOCATION],
      GREETING: [...botVocabulary.intents.GREETING],
    },
    responses: {
      GREETING: [...botVocabulary.responses.GREETING],
      NOT_FOUND: [...botVocabulary.responses.NOT_FOUND],
    },
  };
}