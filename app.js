// app.js
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allProducts = [];
let currentUser = null;

// 1. Track Visitor IP & User Info automatically
async function logVisitor(userObj = null) {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const ipData = await res.json();

    await addDoc(collection(db, "visitors"), {
      ip: ipData.ip || "Unknown IP",
      city: ipData.city || "Unknown",
      country: ipData.country_name || "Unknown",
      userName: userObj ? `${userObj.displayName || "User"} (${userObj.email})` : "Guest Visitor",
      userAgent: navigator.userAgent.slice(0, 80),
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("IP tracking skipped:", err);
  }
}

// 2. Auth State Listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const authArea = document.getElementById("authArea");
  if (user) {
    authArea.innerHTML = `
      <span style="color:#00ff88; margin-right:10px; font-weight:600;">👤 ${user.displayName || user.email}</span>
      <button class="btn-outline" id="logoutBtn">Logout</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
    logVisitor(user);
  } else {
    authArea.innerHTML = `
      <button class="btn-outline" onclick="openAuthModal('login')">Login</button>
      <button class="btn-primary" onclick="openAuthModal('register')">Sign Up</button>
    `;
    if (!sessionStorage.getItem("guestLogged")) {
      logVisitor(null);
      sessionStorage.setItem("guestLogged", "true");
    }
  }
});

// 3. Create Account Directly with Firebase Auth
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!name || !email || password.length < 6) {
    alert("Please enter Name, valid Gmail, and Password (min 6 chars).");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: name });
    document.getElementById("registerForm").reset();
    alert("✅ Account created! Welcome to Nawab Digital Store.");
    closeModal("authModal");
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// 4. Login User
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("loginForm").reset();
    alert("✅ Logged in successfully!");
    closeModal("authModal");
  } catch (err) {
    alert("❌ Login Failed: " + err.message);
  }
});

// 5. Load Products Real-Time from Firebase
const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
onSnapshot(qProducts, (snapshot) => {
  allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderProducts(allProducts);
});

function renderProducts(productsList) {
  const grid = document.getElementById("productsGrid");
  if (productsList.length === 0) {
    grid.innerHTML = `<p style="color:#9ca3af;">No products available right now.</p>`;
    return;
  }

  grid.innerHTML = productsList.map(p => {
    const discountPercent = Math.round(((p.realPrice - p.discountPrice) / p.realPrice) * 100);
    return `
      <div class="product-card">
        <img src="${p.image || 'https://via.placeholder.com/400x250?text=Nawab+Store'}" alt="${p.name}" />
        <div class="product-body">
          <span class="product-cat">${p.category}</span>
          <h3 class="product-title">${p.name}</h3>
          <p class="product-short">${p.description.slice(0, 75)}...</p>
          <div class="price-box">
            <span class="new-price">Rs. ${p.discountPrice}</span>
            <span class="old-price">Rs. ${p.realPrice}</span>
            ${discountPercent > 0 ? `<span class="discount-tag">-${discountPercent}%</span>` : ""}
          </div>
          <button class="btn-primary full-width" onclick="openProductDetails('${p.id}')">See More & Order</button>
        </div>
      </div>
    `;
  }).join("");
}

// 6. Category Filter & Search
document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const cat = btn.dataset.cat;
    const filtered = cat === "All" ? allProducts : allProducts.filter(p => p.category === cat);
    renderProducts(filtered);
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
  );
  renderProducts(filtered);
});

// 7. Open Product Details Modal
window.openProductDetails = (id) => {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;

  document.getElementById("modalImg").src = prod.image;
  document.getElementById("modalCategory").innerText = prod.category;
  document.getElementById("modalTitle").innerText = prod.name;
  document.getElementById("modalDiscountPrice").innerText = `Rs. ${prod.discountPrice}`;
  document.getElementById("modalRealPrice").innerText = `Rs. ${prod.realPrice}`;
  document.getElementById("modalDesc").innerText = prod.description;

  document.getElementById("orderProductId").value = prod.id;
  document.getElementById("orderProductName").value = prod.name;
  document.getElementById("orderProductPrice").value = prod.discountPrice;

  if (currentUser && currentUser.displayName) {
    document.getElementById("custName").value = currentUser.displayName;
  }

  document.getElementById("productModal").style.display = "block";
};

// 8. Submit Order to Firebase
document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "orders"), {
      productId: document.getElementById("orderProductId").value,
      productName: document.getElementById("orderProductName").value,
      price: document.getElementById("orderProductPrice").value,
      customerName: document.getElementById("custName").value.trim(),
      customerEmail: currentUser ? currentUser.email : "Guest",
      whatsapp: document.getElementById("custWhatsApp").value.trim(),
      paymentInfo: document.getElementById("custPaymentNote").value.trim(),
      status: "Pending",
      createdAt: serverTimestamp()
    });

    alert("🎉 Order Placed Successfully! Admin will contact you on WhatsApp shortly.");
    document.getElementById("orderForm").reset();
    closeModal("productModal");
  } catch (err) {
    alert("Error placing order: " + err.message);
  }
});

// Modal Helpers
window.openAuthModal = (type) => {
  document.getElementById("authModal").style.display = "block";
  if (type === "login") {
    document.getElementById("authTitle").innerText = "Login to Nawab Store";
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
  } else {
    document.getElementById("authTitle").innerText = "Create Account";
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
  }
};

window.closeModal = (id) => {
  document.getElementById(id).style.display = "none";
};
