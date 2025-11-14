import { Outlet, useLocation } from "react-router-dom";
import "./App.css";
import Header from "./components/header";
import Footer from "./components/footer";
import toast, { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import fetchUserDetails from "./utils/fetchUserDetails";
import { setUserDetails } from "./store/userSlice";
import {
  setAllCategory,
  setAllSubCategory,
  setLoadingCategory,
} from "./store/productSlice";
import { useDispatch } from "react-redux";
import Axios from "./utils/Axios";
import SummaryApi from "./common/SummaryApi";
import { handleAddItemCart } from "./store/cartProduct";
import GlobalProvider from "./provider/GlobalProvider";
import { FaCartShopping } from "react-icons/fa6";
import CartMobileLink from "./components/CartMobile";

function App() {
  const dispatch = useDispatch();
  const loaction = useLocation();

  const fetchUser = async () => {
    const userData = await fetchUserDetails();
    dispatch(setUserDetails(userData.data));
  };

  const fetchCategory = async () => {
    try {
      dispatch(setLoadingCategory(true));
      const response = await Axios({
        ...SummaryApi.getCategory,
      });

      const { data: responseData } = response;

      if (responseData.success) {
        dispatch(setAllCategory(responseData.data));
      }

      console.log(responseData);
    } catch (error) {
    } finally {
      dispatch(setLoadingCategory(false));
    }
  };
  const fetchSubCategory = async () => {
    try {
      const response = await Axios({
        ...SummaryApi.getSubCategory,
      });

      const { data: responseData } = response;

      if (responseData.success) {
        dispatch(setAllSubCategory(responseData.data));
      }

      console.log(responseData);
    } catch (error) {
    } finally {
    }
  };

  useEffect(() => {
    fetchUser();
    fetchCategory();
    fetchSubCategory();
    // fetchCartItem();
  }, []);

  return (
    <GlobalProvider>
      <Header />
      <main className="min-h-[78vh]">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      {loaction.pathname !== "/checkout" && <CartMobileLink />}
    </GlobalProvider>
  );
}

export default App;
