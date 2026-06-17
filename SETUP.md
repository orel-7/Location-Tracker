## 🚀 הוראות התקנה מהירות

### שלב 1: התקן Node.js

1. כנס לאתר: https://nodejs.org/
2. הורד את **LTS** (תמיד בחר את ה-LTS)
3. הקמ את ההתקנה ולחץ "Next" לכל שלב
4. **חשוב:** ודא שתיבת ✓ "Add to PATH" מסומנת
5. סיים את ההתקנה

### שלב 2: בדוק התקנה

פתח Command Prompt (cmd) וכתוב:
```
node --version
npm --version
```

אם תראה גרסאות → הכל בסדר! ✓

### שלב 3: התקן תלויות

בתיקיית הפרויקט (בTerminal של VS Code):
```
npm install
```

### שלב 4: הפעל את השרת

```
npm start
```

אתה אמור לראות:
```
🚀 השרת פעיל ב-http://localhost:3000
```

### שלב 5: פתח בדפדפן

כנס ל: http://localhost:3000

---

## 🎯 אם יש בעיות

### "npm: The term 'npm' is not recognized..."
→ Node.js לא הותקן בצורה נכונה
→ הורד מחדש מ-https://nodejs.org/ (LTS!)
→ וודא ש-"Add to PATH" מסומן בהתקנה
→ הפעל Restart! (CMD חדש אחרי התקנה)

### "Cannot find module..."
→ כתוב: `npm install` (שוב)

### "Port 3000 already in use"
→ שנה את ה-PORT ב-.env

---

✨ **בהצלחה!**
