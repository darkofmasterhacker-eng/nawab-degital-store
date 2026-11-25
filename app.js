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
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const WHATSAPP_NUMBER = "966597353083";
const WHATSAPP_DISPLAY = "+966 59 735 3083";

let allProducts = [];
let currentUser = null;
let unsubscribeMyOrders = null;

function getWhatsAppProductUrl(productName, price) {
  const msg = `Assalam-o-Alaikum Nawab Digital Store, I want to order/ask about: ${productName} (Rs. ${price})`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

async function getClientIpInfo() {
  try {
    const res = await fetch("https://ipwho.is/");
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        return {
          ip: data.ip,
          city: data.city || "Unknown",
          country: data.country || "Unknown"
        };
      }
    }
  } catch (_) {}

  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
          city: data.city || "Unknown",
          country: data.country_name || "Unknown"
        };
      }
    }
  } catch (_) {}

  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
          city: "Unknown",
          country: "Unknown"
        };
      }
    }
  } catch (_) {}

  return { ip: "Unknown IP", city: "Unknown", country: "Unknown" };
}

async function logVisitor(userObj = null) {
  try {
    const ipInfo = await getClientIpInfo();

    await addDoc(collection(db, "visitors"), {
      ip: ipInfo.ip,
      city: ipInfo.city,
      country: ipInfo.country,
      userName: userObj ? `${userObj.displayName || "User"} (${userObj.email})` : "Guest Visitor",
      userAgent: navigator.userAgent.slice(0, 80),
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("Visitor log error:", err);
  }
}

function loadUserOrders(email) {
  const tbody = document.getElementById("myOrdersList");
  if (!tbody || !email) return;

  if (unsubscribeMyOrders) {
    unsubscribeMyOrders();
  }

  const qOrders = query(
    collection(db, "orders"),
    where("customerEmail", "==", email),
    orderBy("createdAt", "desc")
  );

  unsubscribeMyOrders = onSnapshot(
    qOrders,
    (snap) => {
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="6">You have not placed any orders yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = snap.docs
        .map((d) => {
          const o = d.data();
          const date = o.createdAt ? o.createdAt.toDate().toLocaleString() : "Just now";
          return `
            <tr>
              <td>${date}</td>
              <td>${o.productName}</td>
              <td style="color:#00ff88; font-weight:bold;">Rs. ${o.price}</td>
              <td>${o.whatsapp}</td>
              <td>${o.paymentInfo}</td>
              <td><strong>${o.status || "Pending"}</strong></td>
            </tr>
          `;
        })
        .join("");
    },
    (err) => {
      console.error("Orders query error:", err);
      tbody.innerHTML = `<tr><td colspan="6">Could not load orders right now.</td></tr>`;
    }
  );
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const authArea = document.getElementById("authArea");

  if (user) {
    if (authArea) {
      authArea.innerHTML = `
        <a href="profile.html" style="color:#00ff88; margin-right:10px; font-weight:600; text-decoration:none;">👤 ${user.displayName || user.email}</a>
        <button class="btn-outline" id="logoutBtn">Logout</button>
      `;
      document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
    }

    const userSessionKey = `userLogged_${user.uid}`;
    if (!sessionStorage.getItem(userSessionKey)) {
      logVisitor(user);
      sessionStorage.setItem(userSessionKey, "true");
    }

    const notLoggedBox = document.getElementById("notLoggedInBox");
    const profileBox = document.getElementById("profileDetailsBox");
    const ordersSec = document.getElementById("myOrdersSection");

    if (notLoggedBox) notLoggedBox.style.display = "none";
    if (profileBox) {
      profileBox.style.display = "block";
      document.getElementById("profileName").innerText = user.displayName || "Nawab Store User";
      document.getElementById("profileEmail").innerText = user.email;
    }
    if (ordersSec) {
      ordersSec.style.display = "block";
      loadUserOrders(user.email);
    }
  } else {
    if (unsubscribeMyOrders) {
      unsubscribeMyOrders();
      unsubscribeMyOrders = null;
    }
    if (authArea) {
      authArea.innerHTML = `
        <button class="btn-outline" onclick="openAuthModal('login')">Login</button>
        <button class="btn-primary" onclick="openAuthModal('register')">Sign Up</button>
      `;
    }
    if (!sessionStorage.getItem("guestLogged")) {
      logVisitor(null);
      sessionStorage.setItem("guestLogged", "true");
    }

    const notLoggedBox = document.getElementById("notLoggedInBox");
    const profileBox = document.getElementById("profileDetailsBox");
    const ordersSec = document.getElementById("myOrdersSection");
    if (notLoggedBox) notLoggedBox.style.display = "block";
    if (profileBox) profileBox.style.display = "none";
    if (ordersSec) ordersSec.style.display = "none";
  }
});

// 4. Create Account Directly with Firebase Auth + Save to Firestore `users`
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
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

      const ipInfo = await getClientIpInfo();
      await addDoc(collection(db, "users"), {
        uid: userCred.user.uid,
        name,
        email,
        ip: ipInfo.ip,
        city: ipInfo.city,
        country: ipInfo.country,
        createdAt: serverTimestamp()
      });

      sessionStorage.setItem(`userLogged_${userCred.user.uid}`, "true");
      registerForm.reset();
      alert("✅ Account created! Welcome to Nawab Digital Store.");
      closeModal("authModal");
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

// 5. Login User
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginForm.reset();
      alert("✅ Logged in successfully!");
      closeModal("authModal");
    } catch (err) {
      alert("❌ Login Failed: " + err.message);
    }
  });
}

// 6. Load Products Real-Time from Firebase
const productsGrid = document.getElementById("productsGrid");
if (productsGrid) {
  const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
  onSnapshot(qProducts, (snapshot) => {
    allProducts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderProducts(allProducts);
  });
}

function renderProducts(productsList) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  if (productsList.length === 0) {
    grid.innerHTML = `<p style="color:#9ca3af;">No products available right now.</p>`;
    return;
  }

  grid.innerHTML = productsList
    .map((p) => {
      const discountPercent =
        p.realPrice > 0 ? Math.round(((p.realPrice - p.discountPrice) / p.realPrice) * 100) : 0;
      const waUrl = getWhatsAppProductUrl(p.name, p.discountPrice);

      return `
        <div class="product-card">
          <img src="${p.image || "https://via.placeholder.com/400x250?text=Nawab+Store"}" alt="${p.name}" />
          <div class="product-body">
            <span class="product-cat">${p.category}</span>
            <h3 class="product-title">${p.name}</h3>
            <p class="product-short">${p.description.slice(0, 75)}...</p>
            <div class="price-box">
              <span class="new-price">Rs. ${p.discountPrice}</span>
              <span class="old-price">Rs. ${p.realPrice}</span>
              ${discountPercent > 0 ? `<span class="discount-tag">-${discountPercent}%</span>` : ""}
            </div>
            <p class="wa-card-number"><i class="fab fa-whatsapp"></i> ${WHATSAPP_DISPLAY}</p>
            <div class="card-actions">
              <button class="btn-primary" onclick="openProductDetails('${p.id}')">Order Now</button>
              <a href="${waUrl}" target="_blank" rel="noopener" class="btn-wa">WhatsApp</a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const cat = btn.dataset.cat;

    const heading = document.getElementById("selectedCategoryHeading");
    if (heading) {
      heading.innerHTML = `Showing: <span>${cat === "All" ? "All Products" : cat}</span>`;
    }

    const filtered = cat === "All" ? allProducts : allProducts.filter((p) => p.category === cat);
    renderProducts(filtered);
  });
});

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allProducts.filter(
      (p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
    );
    renderProducts(filtered);
  });
}

window.openProductDetails = (id) => {
  const prod = allProducts.find((p) => p.id === id);
  if (!prod) return;

  document.getElementById("modalImg").src = prod.image;
  document.getElementById("modalCategory").innerText = prod.category;
  document.getElementById("modalTitle").innerText = prod.name;
  document.getElementById("modalDiscountPrice").innerText = `Rs. ${prod.discountPrice}`;
  document.getElementById("modalRealPrice").innerText = `Rs. ${prod.realPrice}`;
  document.getElementById("modalDesc").innerText = prod.description;

  const waLinkEl = document.getElementById("modalWaLink");
  if (waLinkEl) {
    waLinkEl.href = getWhatsAppProductUrl(prod.name, prod.discountPrice);
  }

  document.getElementById("orderProductId").value = prod.id;
  document.getElementById("orderProductName").value = prod.name;
  document.getElementById("orderProductPrice").value = prod.discountPrice;

  if (currentUser && currentUser.displayName) {
    document.getElementById("custName").value = currentUser.displayName;
  }

  document.getElementById("productModal").style.display = "block";
};

const orderForm = document.getElementById("orderForm");
if (orderForm) {
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const ipInfo = await getClientIpInfo();

      await addDoc(collection(db, "orders"), {
        productId: document.getElementById("orderProductId").value,
        productName: document.getElementById("orderProductName").value,
        price: document.getElementById("orderProductPrice").value,
        customerName: document.getElementById("custName").value.trim(),
        customerEmail: currentUser ? currentUser.email : "Guest",
        customerIp: ipInfo.ip,
        whatsapp: document.getElementById("custWhatsApp").value.trim(),
        paymentInfo: document.getElementById("custPaymentNote").value.trim(),
        status: "Pending",
        createdAt: serverTimestamp()
      });

      alert("🎉 Order Placed Successfully! Admin will contact you on WhatsApp shortly.");
      orderForm.reset();
      closeModal("productModal");
    } catch (err) {
      alert("Error placing order: " + err.message);
    }
  });
}

window.openAuthModal = (type) => {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.style.display = "block";
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
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
};
