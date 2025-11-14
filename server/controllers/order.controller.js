import CartProductModel from "../models/cartproduct.model.js";
import OrderModel from "../models/order.model.js";
import UserModel from "../models/user.model.js";
import mongoose from "mongoose";
import Stripe from "../config/stripe.js";

export async function CashOnDeliveryOrderController(req, res) {
  try {
    const userId = req.userId; //from auth middleware
    const { list_items, totalAmt, addressId, subTotalAmt } = req.body;

    const payload = list_items.map((el) => {
      return {
        userId: userId,
        orderId: `ORD-${new mongoose.Types.ObjectId()}`,
        productId: el.productId._id,
        product_details: {
          name: el.productId.name,
          image: el.productId.image,
        },
        paymentId: "",
        payment_status: "CASH ON DELIVERY",
        delivery_address: addressId,
        subTotalAmt: subTotalAmt,
        totalAmt: totalAmt,
      };
    });

    const generateOrder = await OrderModel.insertMany(payload);

    /// remove from the cart
    const removeCartItems = await CartProductModel.deleteMany({
      userId: userId,
    });
    const updateInUser = await UserModel.updateOne(
      { _id: userId },
      { shopping_cart: [] }
    );

    return res.json({
      message: "Order successfully",
      error: false,
      success: true,
      data: generateOrder,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

export const priceWithDiscount = (price, dis = 1) => {
  const discountAmount = Math.ceil((Number(price) * Number(dis)) / 100);
  const actualPrice = Number(price) - Number(discountAmount);
  return actualPrice;
};

export async function paymentController(req, res) {
  try {
    const userId = req.userId; //from auth middleware
    const { list_items, totalAmt, addressId, subTotalAmt } = req.body;

    const user = await UserModel.findById(userId);

    const line_items = list_items.map((item) => {
      return {
        price_data: {
          currency: "inr",
          product_data: {
            name: item.productId.name,
            images: item.productId.image,
            metadata: {
              productId: item.productId._id,
            },
          },
          unit_amount:
            priceWithDiscount(item.productId.price, item.productId.discount) *
            100,
        },
        adjustable_quantity: {
          enabled: true,
          minimum: 1,
        },
        quantity: item.quantity,
      };
    });

    const params = {
      submit_type: "pay",
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      metadata: {
        userId: userId,
        addressId: addressId,
      },
      line_items: line_items,
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    };
    const session = await Stripe.checkout.sessions.create(params);

    // console.log("(Backend) session: ", session);

    return res.status(200).json(session);
  } catch (error) {
    return res.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

const getOrderProductItems = async ({
  lineItems,
  userId,
  addressId,
  paymentId,
  payment_status,
}) => {
  const productList = [];

  if (lineItems?.data?.length) {
    for (const item of lineItems.data) {
      const product = await Stripe.products.retrieve(item.price.product);

      const payload = {
        userId: userId,
        orderId: `ORD-${new mongoose.Types.ObjectId()}`,
        productId: product.metadata.productId,
        product_details: {
          name: product.name,
          image: product.images,
        },
        paymentId: paymentId,
        payment_status: payment_status,
        delivery_address: addressId,
        subTotalAmt: Number(item.amount_total / 100),
        totalAmt: Number(item.amount_total / 100),
      };

      productList.push(payload);
    }
  }

  return productList;
};

// ChatGPT-------------------------------------------
//http://localhost:8080/api/order/webhook
export async function webhookStripe(req, res) {
  const event = req.body;
  const endPointSecret = process.env.STRIPE_ENDPOINT_WEBHOOK_SECRET_KEY;

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      const lineItems = await Stripe.checkout.sessions.listLineItems(
        session.id
      );

      const userId = session.metadata.userId;
      const orderProduct = await getOrderProductItems({
        lineItems: lineItems,
        userId: userId,
        addressId: session.metadata.addressId,
        paymentId: session.payment_intent,
        payment_status: session.payment_status,
      });

      const order = await OrderModel.insertMany(orderProduct);

      if (Boolean(order[0])) {
        const removeCartItems = await UserModel.findByIdAndUpdate(userId, {
          shopping_cart: [],
        });
        const removeCartProductDB = await CartProductModel.deleteMany({
          userId: userId,
        });
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
}

export async function getOrderDetailsController(req, res) {
  try {
    const userId = req.userId; // order id

    const orderlist = await OrderModel.find({ userId: userId })
      .sort({ createdAt: -1 })
      .populate("delivery_address");

    return res.json({
      message: "order list",
      data: orderlist,
      error: false,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

//http://localhost:8080/api/order/webhook
// export async function webhookStripe(req, res) {
//   console.log("webhookStripe-----------------------------------------------");
//   const event = req.body;
//   const endPointSecret = process.env.STRIPE_ENDPOINT_WEBHOOK_SECRET_KEY;

//   console.log("event----------------------: ", event);

//   // Handle the event
//   switch (event.type) {
//     case "payment_intent.succeeded":
//       console.log("webhookStripe222222222222222222222222");
//       const session = event.data.object;
//       console.log("webhookStripe3333333333333333333333333333333");
//       const lineItems = await Stripe.checkout.sessions.listLineItems(
//         session.id
//       );

//       console.log("webhookStripe44444444444444444444444444");
//       const userId = session.metadata.userId;
//       const orderProduct = await getOrderProductItems({
//         lineItems: lineItems,
//         userId: userId,
//         addressId: session.metadata.addressId,
//         paymentId: session.payment_intent,
//         payment_status: session.payment_status,
//       });

//       console.log("webhookStripe555555555555555555555555555555");

//       const order = await OrderModel.insertMany(orderProduct);

//       console.log("webhookStripe66666666666666666666666666666666666");
//       if(Boolean(order[0])) {
//         console.log("webhookStripe7777777777777777777777777777777777777");
//         const removeCartItems = await UserModel.findByIdAndUpdate(userId, {
//           shopping_cart: []
//         })
//         console.log("webhookStripe88888888888888888888888888888888888888888");
//         const removeCartProductDB = await CartProductModel.deleteMany({ userId: userId });
//       }

//       break;
//     default:
//       console.log("webhookStripe9999999999999999999999999999999999999");
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   // Return a response to acknowledge receipt of the event
//   console.log("webhookStripe10101010101010101010101010101010101010101010");
//   res.json({ received: true });
// }
