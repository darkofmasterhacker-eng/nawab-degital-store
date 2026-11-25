// admin.js
import { db, ADMIN_SECRET_PIN } from "./firebase-config.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. Admin Lock Screen Verification
document.getElementById("unlockAdminBtn").addEventListener("click", () => {
  const pin = document.getElementById("adminPinInput").value;
  if (pin === ADMIN_SECRET_PIN) {
    document.getElementById("adminLockScreen").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    initAdminData();
  } else {
    document.getElementById("pinError").innerText = "❌ Access Denied! Wrong Security PIN.";
  }
});

// Switch Admin Tabs
window.switchAdminTab = (tabId, btnEl = null) => {
  document.querySelectorAll(".admin-section").forEach((sec) => (sec.style.display = "none"));
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";

  if (btnEl) {
    btnEl.classList.add("active");
  } else {
    const matchingBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (matchingBtn) matchingBtn.classList.add("active");
  }
};

// Convert Local Image File to Compressed Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

let productsCache = [];

function initAdminData() {
  // Load Products
  onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snap) => {
    productsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const tbody = document.getElementById("adminProductsList");
    tbody.innerHTML = productsCache
      .map(
        (p) => `
      <tr>
        <td><img src="${p.image}" alt="" /></td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>Rs. ${p.realPrice}</td>
        <td style="color:#00ff88; font-weight:bold;">Rs. ${p.discountPrice}</td>
        <td>
          <button class="btn-outline" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </td>
      </tr>
    `
      )
      .join("");
  });

  // Load Orders (Including User IP Address)
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
    const tbody = document.getElementById("adminOrdersList");
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="9">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs
      .map((d) => {
        const o = d.data();
        const date = o.createdAt ? o.createdAt.toDate().toLocaleString() : "Just now";
        return `
        <tr>
          <td>${date}</td>
          <td>${o.customerName}<br><small style="color:#9ca3af">${o.customerEmail}</small></td>
          <td>${o.whatsapp}</td>
          <td>${o.productName}</td>
          <td style="color:#00ff88;">Rs. ${o.price}</td>
          <td style="color:#00ff88; font-family:monospace;">${o.customerIp || "Unknown IP"}</td>
          <td>${o.paymentInfo}</td>
          <td><strong>${o.status}</strong></td>
          <td>
            <button class="btn-primary" onclick="markOrderDone('${d.id}')">Complete</button>
            <button class="btn-danger" onclick="deleteOrder('${d.id}')">X</button>
          </td>
        </tr>
      `;
      })
      .join("");
  });

  // Load Visitor IPs, Date & Time + Total Count
  onSnapshot(query(collection(db, "visitors"), orderBy("timestamp", "desc")), (snap) => {
    const total = snap.size;
    const countEl = document.getElementById("visitorCount");
    const titleEl = document.getElementById("visitorTotalTitle");
    if (countEl) countEl.innerText = total;
    if (titleEl) titleEl.innerText = total;

    const tbody = document.getElementById("adminVisitorsList");
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5">No visitor logs yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs
      .map((d) => {
        const v = d.data();
        const time = v.timestamp ? v.timestamp.toDate().toLocaleString() : "Just now";
        return `
        <tr>
          <td>${time}</td>
          <td style="color:#00ff88; font-family:monospace;">${v.ip || "Unknown IP"}</td>
          <td><strong>${v.userName || "Guest Visitor"}</strong></td>
          <td>${v.city || "Unknown"}, ${v.country || "Unknown"}</td>
          <td><small>${v.userAgent || "-"}</small></td>
        </tr>
      `;
      })
      .join("");
  });

  // Load Registered Users (Name, Gmail, Real IP, Date & Time) + Total Count
  onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
    const total = snap.size;
    const countEl = document.getElementById("userCount");
    const titleEl = document.getElementById("userTotalTitle");
    if (countEl) countEl.innerText = total;
    if (titleEl) titleEl.innerText = total;

    const tbody = document.getElementById("adminUsersList");
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5">No registered users yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs
      .map((d) => {
        const u = d.data();
        const date = u.createdAt ? u.createdAt.toDate().toLocaleString() : "Just now";
        return `
        <tr>
          <td>${date}</td>
          <td><strong>${u.name || "User"}</strong></td>
          <td>${u.email || "-"}</td>
          <td style="color:#00ff88; font-family:monospace;">${u.ip || "Unknown IP"}</td>
          <td>${u.city || "Unknown"}, ${u.country || "Unknown"}</td>
        </tr>
      `;
      })
      .join("");
  });
}

// Add or Edit Product Submit
document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("editProductId").value;
  const fileInput = document.getElementById("prodImageFile").files[0];
  let imageUrl = document.getElementById("prodImageUrl").value.trim();

  if (fileInput) {
    imageUrl = await fileToBase64(fileInput);
  }

  const productData = {
    name: document.getElementById("prodName").value.trim(),
    category: document.getElementById("prodCategory").value,
    realPrice: Number(document.getElementById("prodRealPrice").value),
    discountPrice: Number(document.getElementById("prodDiscountPrice").value),
    description: document.getElementById("prodDesc").value.trim(),
    ...(imageUrl && { image: imageUrl })
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "products", editId), productData);
      alert("✅ Product Updated!");
    } else {
      if (!imageUrl) {
        alert("Please upload an image or paste an image URL.");
        return;
      }
      productData.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), productData);
      alert("✅ New Product Uploaded to Store!");
    }
    resetProductForm();
  } catch (err) {
    alert("Error saving product: " + err.message);
  }
});

// Edit Product Populate
window.editProduct = (id) => {
  const prod = productsCache.find((p) => p.id === id);
  if (!prod) return;

  document.getElementById("editProductId").value = prod.id;
  document.getElementById("prodName").value = prod.name;
  document.getElementById("prodCategory").value = prod.category;
  document.getElementById("prodRealPrice").value = prod.realPrice;
  document.getElementById("prodDiscountPrice").value = prod.discountPrice;
  document.getElementById("prodImageUrl").value = prod.image;
  document.getElementById("prodDesc").value = prod.description;

  document.getElementById("formHeading").innerText = "Edit Product";
  document.getElementById("saveProdBtn").innerText = "Update Product";
  document.getElementById("cancelEditBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.resetProductForm = () => {
  document.getElementById("productForm").reset();
  document.getElementById("editProductId").value = "";
  document.getElementById("formHeading").innerText = "Add New Product";
  document.getElementById("saveProdBtn").innerText = "Upload Product";
  document.getElementById("cancelEditBtn").style.display = "none";
};

window.deleteProduct = async (id) => {
  if (confirm("Are you sure you want to delete this product?")) {
    await deleteDoc(doc(db, "products", id));
  }
};

window.markOrderDone = async (id) => {
  await updateDoc(doc(db, "orders", id), { status: "Completed ✅" });
};

window.deleteOrder = async (id) => {
  if (confirm("Delete this order record?")) {
    await deleteDoc(doc(db, "orders", id));
  }
};

document.getElementById("clearLogsBtn").addEventListener("click", async () => {
  if (confirm("Clear all visitor IP logs?")) {
    const snap = await getDocs(collection(db, "visitors"));
    snap.forEach((d) => deleteDoc(doc(db, "visitors", d.id)));
  }
});
