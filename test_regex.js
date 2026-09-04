const text1 = "01340328713283069230";
const text2 = "20127528";

let chatDetectedAccount = null;
let chatDetectedCedula = null;

const messages = [text2, text1];

for (const text of messages) {
    if (!chatDetectedAccount) {
        const m1 = text.match(/(?<![.\d])(0\d{19})(?![\d])/);
        if (m1) {
            chatDetectedAccount = m1[1];
        }
    }
    if (!chatDetectedCedula) {
        const mPref = text.match(/[VvEe][-.\s]?(\d{6,9})/);
        if (mPref) {
            chatDetectedCedula = mPref[1].replace(/\./g, '');
        } else {
            const mRaw = text.match(/(?<![.\-\d])(\d{7,9})(?![\-\d])/);
            if (mRaw) {
                const candidate = mRaw[1];
                if (!chatDetectedAccount || !chatDetectedAccount.includes(candidate)) {
                    chatDetectedCedula = candidate;
                }
            }
        }
    }
}

console.log("Account:", chatDetectedAccount);
console.log("Cedula:", chatDetectedCedula);
