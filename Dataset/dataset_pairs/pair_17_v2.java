/*version 2 */
package com.alibaba.dubbo.remoting.transport;

import com.alibaba.dubbo.remoting.ChannelHandler;

/**
 * @author chao.liuc
 */
public interface ChannelHandlerDelegate extends ChannelHandler {

    public ChannelHandler getHandler();
}
